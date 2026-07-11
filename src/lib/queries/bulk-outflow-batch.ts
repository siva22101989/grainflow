import { createClient } from '@/utils/supabase/server';
import { getUserWarehouse } from '@/lib/queries';

/**
 * Loads all data needed to render one consolidated bulk-outflow bill.
 *
 * Identifies a batch by the shared `consolidated_invoice_no` on
 * `withdrawal_transactions`. Returns the customer, every slice (one per
 * record), aggregate totals, and the warehouse for header info.
 *
 * Excludes soft-deleted withdrawals from the bill — if a slice was reversed
 * after the batch was created, it shouldn't appear on the printable bill.
 * (Decision was "Bill regenerates live — always reflects current state".)
 */
export type BulkOutflowBatchSlice = {
    withdrawalId: string;
    withdrawalNumber: number | null;
    recordId: string;
    recordNumber: number | null;
    location: string | null;
    storageStartDate: Date;
    bagsTaken: number;
    rentCollected: number;
    discount: number;
    hamaliCharged: number;
    insuranceCharged: number;
    isClosed: boolean;
};

export type BulkOutflowBatchData = {
    invoiceNo: string;
    batchId: string | null;
    withdrawalDate: Date;
    customer: {
        id: string;
        name: string;
        phone: string | null;
        village: string | null;
        fatherName: string | null;
        customerNumber: number | null;
    };
    warehouse: {
        id: string;
        name: string;
        location: string | null;
        gstNumber: string | null;
        phone: string | null;
    } | null;
    commodity: string;
    slices: BulkOutflowBatchSlice[];
    totals: {
        totalBags: number;
        totalRent: number;
        totalDiscount: number;
        totalHamali: number;
        totalInsurance: number;
        totalBilled: number; // rent + hamali + insurance (discount is already subtracted in rent_collected for batch rows)
        totalPaidOnDate: number; // payments made on the same date (proxy for "paid now during this batch")
        balance: number;
    };
};

export async function getBulkOutflowBatch(invoiceNo: string): Promise<BulkOutflowBatchData | null> {
    if (!invoiceNo) return null;

    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return null;

    // 1. Pull all NON-deleted withdrawal rows sharing this consolidated invoice
    const { data: withdrawals, error: wErr } = await supabase
        .from('withdrawal_transactions')
        .select(`
            id,
            withdrawal_number,
            storage_record_id,
            bags_withdrawn,
            withdrawal_date,
            rent_collected,
            discount,
            hamali_charged,
            insurance_charged,
            batch_id,
            consolidated_invoice_no,
            storage_records!inner (
                id,
                record_number,
                location,
                storage_start_date,
                storage_end_date,
                commodity_description,
                warehouse_id,
                customer_id,
                customers ( id, name, phone, village, father_name, customer_number )
            )
        `)
        .eq('consolidated_invoice_no', invoiceNo)
        .is('deleted_at', null)
        .eq('storage_records.warehouse_id', warehouseId);

    if (wErr || !withdrawals || withdrawals.length === 0) {
        return null;
    }

    // All rows in a batch belong to the same customer/commodity by construction.
    // Use the first row as the source of truth for header info.
    const first: any = withdrawals[0];
    const sr = first.storage_records;
    const c = sr.customers;

    // 2. Build slices
    const slices: BulkOutflowBatchSlice[] = withdrawals.map((w: any) => ({
        withdrawalId: w.id,
        withdrawalNumber: w.withdrawal_number ?? null,
        recordId: w.storage_records.id,
        recordNumber: w.storage_records.record_number ?? null,
        location: w.storage_records.location ?? null,
        storageStartDate: new Date(w.storage_records.storage_start_date),
        bagsTaken: w.bags_withdrawn || 0,
        rentCollected: Number(w.rent_collected || 0),
        discount: Number(w.discount || 0),
        hamaliCharged: Number(w.hamali_charged || 0),
        insuranceCharged: Number(w.insurance_charged || 0),
        isClosed: !!w.storage_records.storage_end_date,
    }));

    // Stable order: by record number, fallback to storage_start_date
    slices.sort((a, b) => {
        if (a.recordNumber && b.recordNumber) return a.recordNumber - b.recordNumber;
        return a.storageStartDate.getTime() - b.storageStartDate.getTime();
    });

    // 3. Totals
    const totalBags = slices.reduce((s, x) => s + x.bagsTaken, 0);
    const totalRent = slices.reduce((s, x) => s + x.rentCollected, 0); // already net of per-slice discount
    const totalDiscount = slices.reduce((s, x) => s + x.discount, 0);
    const totalHamali = slices.reduce((s, x) => s + x.hamaliCharged, 0);
    const totalInsurance = slices.reduce((s, x) => s + x.insuranceCharged, 0);

    // 4. Look up payments on the same withdrawal_date (proxy for "paid now during this batch")
    const withdrawalDate = new Date(first.withdrawal_date);
    const recordIds = [...new Set(slices.map(s => s.recordId))];

    const dayStart = new Date(withdrawalDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(withdrawalDate);
    dayEnd.setHours(23, 59, 59, 999);

    let totalPaidOnDate = 0;
    if (recordIds.length > 0) {
        const { data: pays } = await supabase
            .from('payments')
            .select('amount, payment_date, notes')
            .in('storage_record_id', recordIds)
            .is('deleted_at', null)
            .gte('payment_date', dayStart.toISOString())
            .lte('payment_date', dayEnd.toISOString());

        if (pays) {
            // Only count payments whose notes mention this batch (avoids
            // picking up unrelated same-day rent payments). batchId is the
            // discriminator used in addPaymentToRecord notes.
            const batchKey = (first.batch_id || '').slice(0, 8);
            totalPaidOnDate = pays
                .filter((p: any) => batchKey && (p.notes || '').includes(batchKey))
                .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        }
    }

    const totalBilled = totalRent + totalHamali + totalInsurance; // discount already netted into rent_collected
    const balance = Math.max(0, totalBilled - totalPaidOnDate);

    // 5. Warehouse for header
    const { data: w } = await supabase
        .from('warehouses')
        .select('id, name, location, gst_number, phone')
        .eq('id', warehouseId)
        .single();

    return {
        invoiceNo,
        batchId: first.batch_id || null,
        withdrawalDate,
        customer: {
            id: c.id,
            name: c.name,
            phone: c.phone || null,
            village: c.village || null,
            fatherName: c.father_name || null,
            customerNumber: c.customer_number ?? null,
        },
        warehouse: w ? {
            id: w.id,
            name: w.name,
            location: w.location || null,
            gstNumber: w.gst_number || null,
            phone: w.phone || null,
        } : null,
        commodity: sr.commodity_description || '',
        slices,
        totals: {
            totalBags,
            totalRent,
            totalDiscount,
            totalHamali,
            totalInsurance,
            totalBilled,
            totalPaidOnDate,
            balance,
        },
    };
}
