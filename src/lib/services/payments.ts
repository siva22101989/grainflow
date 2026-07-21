import { createClient } from '@/utils/supabase/server';
import { addPaymentToRecord } from '@/lib/data';
import { BillingService } from '@/lib/billing';
import { getStorageRecord, getCustomer, getUserWarehouse } from '@/lib/queries';
import type { Payment } from '@/lib/definitions';
import { createNotification } from '@/lib/logger';
import { computeChargeDues, splitPaymentAllCharges } from '@/lib/auto-settle';

export class PaymentService {
  /**
   * Create a single payment for a storage record
   */
  static async createPayment(recordId: string, payment: Payment) {
    // 1. Validate Record Exists
    const record = await getStorageRecord(recordId);
    if (!record) {
      throw new Error('Storage record not found');
    }

    // 2. Add Payment via Data Layer
    await addPaymentToRecord(recordId, payment);

    // 3. Send Notification (Side Effect)
    // We do this in background or await it? Await for now to ensure delivery.
    try {
      const customer = await getCustomer(record.customerId);
      if (customer) {
        if (payment.type === 'waiver') {
          await createNotification(
            'Discount Applied',
            `Discount / waiver of ₹${payment.amount} applied to ${customer.name}'s balance`,
            'info',
            'payment'
          );
        } else {
          const paymentTypeLabel = payment.type === 'hamali' ? 'Hamali' : 'Rent/Storage';
          await createNotification(
            'Payment Received',
            `Payment of ₹${payment.amount} received from ${customer.name} for ${paymentTypeLabel}`,
            'info',
            'payment'
          );
        }
      }
    } catch (e) {
      console.error('Failed to send payment notification', e);
      // Suppress notification error to not fail payment
    }

    return { success: true, recordId, amount: payment.amount, customerId: record.customerId };
  }

  /**
   * Update an existing payment
   */
  static async updatePayment(paymentId: string, data: Partial<Payment>) {
      const supabase = await createClient();
      
      const updateData: any = {};
      if (data.amount) updateData.amount = data.amount;
      if (data.date) updateData.payment_date = data.date;
      if (data.type) updateData.type = data.type;
      if (data.notes) updateData.notes = data.notes;

      const { error } = await supabase
          .from('payments')
          .update(updateData)
          .eq('id', paymentId);

      if (error) {
          throw error;
      }

      return { success: true };
  }

  /**
   * Delete a payment
   */
  static async deletePayment(paymentId: string) {
      const supabase = await createClient();
      const { error } = await supabase
          .from('payments')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', paymentId);

      if (error) {
          throw error;
      }
      return { success: true };
  }

  /**
   * Fetch pending records for a customer (Records with dues > 0)
   */
  static async getPendingRecords(customerId: string) {
      // Include CLOSED records too — a fully-withdrawn lot can still owe rent,
      // hamali or insurance (we no longer auto-pay those on closure). The
      // totalDue > 0 filter below drops anything already settled, so only
      // records that genuinely still owe money are returned.
      const { data: records } = await (await createClient())
        .from('storage_records')
        .select(`
            id,
            record_number,
            total_rent_billed,
            hamali_payable,
            insurance_payable,
            storage_start_date,
            payments (amount, type, deleted_at)
        `)
        .eq('customer_id', customerId)
        .is('deleted_at', null)
        .order('storage_start_date', { ascending: true });

      if (!records) return [];

      // We need to cast because Supabase select types might not fully match specialized joins automatically
      return (records as any[]).map((r) => {
           const validPayments = (r.payments || []).filter((p: any) => !p.deleted_at);

           // Sum ALL payment types (rent, hamali, insurance, other/online) to get total paid
           const totalPaid = validPayments
            .reduce((sum: number, p: any) => sum + p.amount, 0);

           // Split what's still owed per charge (hamali -> insurance -> rent).
           // The three dues sum to exactly (billed - paid), so totalDue is unchanged.
           const dues = computeChargeDues({
               hamaliPayable: r.hamali_payable || 0,
               insurancePayable: r.insurance_payable || 0,
               rentBilled: r.total_rent_billed || 0,
               totalPaid,
           });

           return {
               id: r.id,
               recordNumber: r.record_number?.toString() || r.id.substring(0, 8),
               hamaliDue: dues.hamaliDue,
               insuranceDue: dues.insuranceDue,
               rentDue: dues.rentDue,
               totalDue: dues.hamaliDue + dues.insuranceDue + dues.rentDue,
               storageStartDate: new Date(r.storage_start_date)
           };
      }).filter((r) => r.totalDue > 0);
  }

  /**
   * Process Bulk Payment using Atomic RPC
   */
  static async processBulk(
      customerId: string,
      totalAmount: number,
      paymentDate: string,
      strategy: 'fifo' | 'manual',
      manualAllocations?: { recordId: string; amount: number }[],
      paymentType: 'rent' | 'hamali' | 'insurance' | 'waiver' | 'all' = 'rent'
  ) {
      const pendingRecords = await PaymentService.getPendingRecords(customerId);

      // "Everything" — one amount auto-split hamali -> insurance -> rent across
      // the oldest bills first, recording each slice with its own correct type.
      if (paymentType === 'all') {
          return PaymentService.processBulkAll(customerId, totalAmount, paymentDate, pendingRecords);
      }

      // Which pending bucket this payment settles. Paying "hamali" only reduces
      // hamali dues, etc. A waiver reduces the overall balance, so it goes
      // against the record's total dues.
      const dueFor = (r: any): number =>
          paymentType === 'hamali' ? r.hamaliDue
        : paymentType === 'insurance' ? r.insuranceDue
        : paymentType === 'rent' ? r.rentDue
        : r.totalDue;

      // Re-project onto totalDue so the shared FIFO helper allocates against the
      // selected charge, and drop records that don't owe it.
      const eligible = pendingRecords
          .map((r: any) => ({ ...r, totalDue: dueFor(r) }))
          .filter((r) => r.totalDue > 0);

      if (eligible.length === 0) {
          const label = paymentType === 'waiver' ? 'dues' : `${paymentType} dues`;
          return { success: false, message: `No pending ${label} found for this customer.` };
      }

      let allocations: { recordId: string; recordNumber: string; amount: number }[];

      if (strategy === 'manual') {
          const allocs = (manualAllocations || []).filter(a => a.amount > 0);
          const sum = allocs.reduce((acc, a) => acc + a.amount, 0);
          if (Math.abs(sum - totalAmount) > 0.01) {
             return { success: false, message: `Allocation sum (₹${sum}) does not match total payment (₹${totalAmount}).` };
          }

          // Never let a manual entry exceed what that record actually owes for this charge.
          for (const ma of allocs) {
              const record = eligible.find((r) => r.id === ma.recordId);
              if (!record) {
                  return { success: false, message: `Record has no pending ${paymentType} dues.` };
              }
              if (ma.amount - record.totalDue > 0.01) {
                  return { success: false, message: `Record #${record.recordNumber}: ₹${ma.amount} exceeds its pending ${paymentType} of ₹${record.totalDue}.` };
              }
          }

          allocations = allocs.map(ma => {
              const record = eligible.find((r) => r.id === ma.recordId);
              return {
                  recordId: ma.recordId,
                  recordNumber: record?.recordNumber || 'Unknown',
                  amount: ma.amount
              };
          });
      } else {
          // FIFO across the records owing this charge (oldest first)
          const result = BillingService.allocatePaymentFIFO(eligible, totalAmount);
          allocations = result.allocations.filter(a => a.amount > 0);

          if (result.unallocated > 0.01) {
              const totalDueForCharge = eligible.reduce((s, r) => s + r.totalDue, 0);
              return { success: false, message: `Payment amount (₹${totalAmount}) exceeds pending ${paymentType === 'waiver' ? 'dues' : paymentType} of ₹${totalDueForCharge}.` };
          }
      }

      // 2. Execute Atomic RPC
      // RPC signature: (p_customer_id, p_payment_date, p_warehouse_id, p_allocations)
      const supabase = await createClient();
      const warehouseId = await getUserWarehouse();

      const { data: rpcData, error: rpcError } = await supabase.rpc('process_bulk_payment_atomic', {
          p_customer_id: customerId,
          p_payment_date: paymentDate,
          p_warehouse_id: warehouseId,
          // Tag every allocation with the payment type so the RPC records cash
          // vs. waiver correctly. Defaults to 'rent' (cash) for the normal flow.
          p_allocations: allocations.map(a => ({ ...a, type: paymentType })),
      });

      if (rpcError) throw rpcError;
      if (!rpcData?.success) throw new Error(rpcData?.message || 'Bulk payment failed');

      const message = paymentType === 'waiver'
          ? `Discounted ₹${totalAmount} across ${allocations.length} record(s).`
          : `Received ₹${totalAmount} toward ${paymentType} across ${allocations.length} record(s).`;
      return {
          success: true,
          allocations,
          recordsUpdated: allocations.length,
          message
      };
  }

  /**
   * "Everything" bulk payment: one amount spread oldest-bill-first, filling each
   * record's hamali -> insurance -> rent in order. Every slice is recorded as a
   * separate payment tagged with its true charge type, so per-charge pending
   * stays accurate.
   */
  private static async processBulkAll(
      customerId: string,
      totalAmount: number,
      paymentDate: string,
      pendingRecords: Awaited<ReturnType<typeof PaymentService.getPendingRecords>>
  ) {
      if (pendingRecords.length === 0) {
          return { success: false, message: 'No pending dues found for this customer.' };
      }

      const totalPending = pendingRecords.reduce((s, r) => s + r.totalDue, 0);
      if (totalAmount - totalPending > 0.01) {
          return { success: false, message: `Payment amount (₹${totalAmount}) exceeds total pending of ₹${totalPending}.` };
      }

      // Charge-first: fully collect hamali across ALL bills (oldest first),
      // then insurance across all, then rent. pendingRecords is already
      // oldest-first (getPendingRecords orders by storage start date).
      const allocations = splitPaymentAllCharges(pendingRecords, totalAmount);

      if (allocations.length === 0) {
          return { success: false, message: 'Nothing to allocate.' };
      }

      const supabase = await createClient();
      const warehouseId = await getUserWarehouse();
      const { data: rpcData, error: rpcError } = await supabase.rpc('process_bulk_payment_atomic', {
          p_customer_id: customerId,
          p_payment_date: paymentDate,
          p_warehouse_id: warehouseId,
          p_allocations: allocations,
      });

      if (rpcError) throw rpcError;
      if (!rpcData?.success) throw new Error(rpcData?.message || 'Bulk payment failed');

      const recordCount = new Set(allocations.map(a => a.recordId)).size;
      return {
          success: true,
          allocations,
          recordsUpdated: recordCount,
          message: `Received ₹${totalAmount} across ${recordCount} record(s), auto-split into hamali, insurance and rent.`
      };
  }
}
