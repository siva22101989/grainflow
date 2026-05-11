import { createClient } from '@/utils/supabase/server';
import { addPaymentToRecord } from '@/lib/data';
import { BillingService } from '@/lib/billing';
import { getStorageRecord, getCustomer, getUserWarehouse } from '@/lib/queries';
import type { Payment } from '@/lib/definitions';
import { createNotification } from '@/lib/logger';

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
        const paymentTypeLabel = payment.type === 'hamali' ? 'Hamali' : 'Rent/Storage';
        await createNotification(
          'Payment Received',
          `Payment of ₹${payment.amount} received from ${customer.name} for ${paymentTypeLabel}`,
          'info',
          'payment'
        );
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
        .is('storage_end_date', null)
        .is('deleted_at', null) // Filter active records
        .order('storage_start_date', { ascending: true });

      if (!records) return [];

      // We need to cast because Supabase select types might not fully match specialized joins automatically
      return (records as any[]).map((r) => {
           const validPayments = (r.payments || []).filter((p: any) => !p.deleted_at);

           // Sum ALL payment types (rent, hamali, insurance, other/online) to get total paid
           const totalPaid = validPayments
            .reduce((sum: number, p: any) => sum + p.amount, 0);

           const totalBilled =
               (r.total_rent_billed || 0) +
               (r.hamali_payable || 0) +
               (r.insurance_payable || 0);
           const totalDue = Math.max(0, totalBilled - totalPaid);

           return {
               id: r.id,
               recordNumber: r.record_number?.toString() || r.id.substring(0, 8),
               totalDue,
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
      manualAllocations?: { recordId: string; amount: number }[]
  ) {
      const pendingRecords = await PaymentService.getPendingRecords(customerId);

      if (pendingRecords.length === 0) {
          return { success: false, message: 'No pending dues found for this customer.' };
      }

      let allocations: { recordId: string; recordNumber: string; amount: number }[];

      if (strategy === 'manual') {
          const allocs = manualAllocations || [];
          const sum = allocs.reduce((acc, a) => acc + a.amount, 0);
          if (Math.abs(sum - totalAmount) > 0.01) {
             return { success: false, message: `Allocation sum (₹${sum}) does not match total payment (₹${totalAmount}).` };
          }
          
          allocations = allocs.map(ma => {
              const record = pendingRecords.find((r) => r.id === ma.recordId);
              return {
                  recordId: ma.recordId,
                  recordNumber: record?.recordNumber || 'Unknown',
                  amount: ma.amount
              };
          });
      } else {
          // FIFO
          const result = BillingService.allocatePaymentFIFO(pendingRecords, totalAmount);
          allocations = result.allocations.filter(a => a.amount > 0);
          
          if (result.unallocated > 0.01) {
              return { success: false, message: `Payment amount (₹${totalAmount}) exceeds total dues (₹${totalAmount - result.unallocated}).` };
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
          p_allocations: allocations,
      });

      if (rpcError) throw rpcError;
      if (!rpcData?.success) throw new Error(rpcData?.message || 'Bulk payment failed');
      
      return { 
          success: true, 
          allocations,
          recordsUpdated: allocations.length,
          message: `Successfully processed ₹${totalAmount} across ${allocations.length} record(s).`
      };
  }
}
