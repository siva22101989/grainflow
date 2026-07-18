'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import * as Sentry from "@sentry/nextjs";

import { createClient } from '@/utils/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getNextInvoiceNumber } from '@/lib/sequence-utils';
import { logError } from '@/lib/error-logger';
import { BillingService } from '@/lib/billing';
import type { StorageRecord } from '@/lib/definitions';
import { getStorageRecord, getCustomer, getUserWarehouse } from '@/lib/queries';
import { isSMSMasterEnabled } from '@/lib/sms-settings-actions';

const { logger } = Sentry;

// Schema for the bulk operation
const BulkOutflowSchema = z.object({
    customerId: z.string().min(1, 'Customer ID is required'),
    commodity: z.string().min(1, 'Commodity is required'),
    totalBagsToWithdraw: z.coerce.number().int().positive('Total bags must be positive'),
    withdrawalDate: z.string().refine(val => {
        const date = new Date(val);
        return !isNaN(date.getTime()) && date <= new Date();
    }, { message: "Date cannot be in the future" }),
    finalRent: z.coerce.number().nonnegative('Final rent cannot be negative'),
    discount: z.coerce.number().nonnegative('Discount cannot be negative').optional(),
    amountPaidNow: z.coerce.number().nonnegative().optional(),
    sendSms: z.boolean().optional(),
    specificRecordIds: z.string().optional(), // Comma-separated IDs
    recordAllocations: z.string().optional(), // JSON: [{recordId, bags}] for manual per-record allocation
});

export type BulkOutflowResult = {
    success: boolean;
    message: string;
    processedCount?: number;
    transactionIds?: string[];
    batchId?: string;
    consolidatedInvoiceNo?: string;
};

export type BulkOutflowPreviewSlice = {
    recordId: string;
    recordNumber: number | string | null;
    location: string | null;
    bagsAvailable: number;
    bagsToTake: number;
    storageStartDate: string;
    rent: number;
};

export type BulkOutflowPreview = {
    success: boolean;
    error?: string;
    slices?: BulkOutflowPreviewSlice[];
    totalBags?: number;
    totalRent?: number;
    bagsRequested?: number;
    bagsShort?: number; // > 0 if not enough stock to fulfil the request
};

/**
 * Read-only FIFO preview for the bulk outflow dialog.
 *
 * Given (customer, commodity, total bags, optional record ID subset, withdrawal
 * date), returns the per-record allocation that processBulkOutflow WOULD make.
 * No locks, no writes. Used by the dialog to render a live preview so the user
 * can sanity-check before submitting.
 *
 * Does the same math as the real action: same FIFO order
 * (storage_start_date ASC), same crop pricing lookup, same per-slice rent calc.
 */
export async function previewBulkOutflow(input: {
    customerId: string;
    commodity: string;
    totalBagsToWithdraw: number;
    withdrawalDate: string;
    specificRecordIds?: string[];
}): Promise<BulkOutflowPreview> {
    try {
        if (!input.customerId || !input.commodity || !input.totalBagsToWithdraw || input.totalBagsToWithdraw <= 0) {
            return { success: false, error: 'Missing required preview inputs.' };
        }

        const supabase = await createClient();

        // Fetch eligible active records for this commodity in FIFO order.
        // No FOR UPDATE — this is a preview, not a reservation.
        let recordQuery = supabase
            .from('storage_records')
            .select('id, record_number, location, bags_stored, storage_start_date, crop_id, hamali_payable, total_rent_billed, billing_cycle, insurance_payable, commodity_description')
            .eq('customer_id', input.customerId)
            .eq('commodity_description', input.commodity)
            .is('storage_end_date', null)
            .is('deleted_at', null)
            .gt('bags_stored', 0)
            .order('storage_start_date', { ascending: true });

        if (input.specificRecordIds && input.specificRecordIds.length > 0) {
            recordQuery = recordQuery.in('id', input.specificRecordIds);
        }

        const { data: rawRecords, error: queryError } = await recordQuery;
        if (queryError) {
            return { success: false, error: queryError.message };
        }
        if (!rawRecords || rawRecords.length === 0) {
            return { success: false, error: 'No active records found for this commodity.' };
        }

        const totalAvailable = rawRecords.reduce((sum, r) => sum + (r.bags_stored || 0), 0);
        const bagsShort = Math.max(0, input.totalBagsToWithdraw - totalAvailable);

        // Load crop pricing for involved crops in one query (same as the real action)
        const cropIds = [...new Set(rawRecords.map(r => r.crop_id).filter(Boolean))];
        const cropPricingMap: Record<string, { price6m: number; price1y: number; pricingSlabs?: any }> = {};
        if (cropIds.length > 0) {
            const { data: crops } = await supabase
                .from('crops')
                .select('id, rent_price_6m, rent_price_1y, pricing_slabs')
                .in('id', cropIds);
            if (crops) {
                for (const crop of crops) {
                    cropPricingMap[crop.id] = {
                        price6m: crop.rent_price_6m,
                        price1y: crop.rent_price_1y,
                        pricingSlabs: crop.pricing_slabs
                    };
                }
            }
        }

        // FIFO walk
        const slices: BulkOutflowPreviewSlice[] = [];
        let bagsRemaining = input.totalBagsToWithdraw;
        const withdrawalDateObj = new Date(input.withdrawalDate);

        for (const r of rawRecords) {
            if (bagsRemaining <= 0) break;
            const bagsToTake = Math.min(r.bags_stored || 0, bagsRemaining);

            // Build a minimal StorageRecord-shaped object for BillingService
            const recordForCalc = {
                id: r.id,
                storageStartDate: new Date(r.storage_start_date),
                billingCycle: r.billing_cycle,
                bagsStored: r.bags_stored,
                bagsIn: r.bags_stored, // not used in calc, just shape
                totalRentBilled: r.total_rent_billed || 0,
                hamaliPayable: r.hamali_payable || 0,
                insurancePayable: r.insurance_payable || 0,
            } as any;

            const cropData = r.crop_id ? cropPricingMap[r.crop_id] : undefined;
            const { rent } = BillingService.calculateRent(
                recordForCalc,
                withdrawalDateObj,
                bagsToTake,
                cropData ? { price6m: cropData.price6m, price1y: cropData.price1y } : undefined,
                cropData?.pricingSlabs
            );

            slices.push({
                recordId: r.id,
                recordNumber: r.record_number,
                location: r.location,
                bagsAvailable: r.bags_stored || 0,
                bagsToTake,
                storageStartDate: r.storage_start_date,
                rent: Math.round(rent * 100) / 100,
            });

            bagsRemaining -= bagsToTake;
        }

        const totalBags = slices.reduce((sum, s) => sum + s.bagsToTake, 0);
        const totalRent = slices.reduce((sum, s) => sum + s.rent, 0);

        return {
            success: true,
            slices,
            totalBags,
            totalRent: Math.round(totalRent * 100) / 100,
            bagsRequested: input.totalBagsToWithdraw,
            bagsShort,
        };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Preview failed.' };
    }
}

/**
 * Processes a bulk outflow operation for a specific customer and commodity.
 * Uses row-level locking via Postgres RPC to prevent race conditions.
 * Generates a batch_id to group all transactions together.
 * Auto-settles hamali when records are fully closed.
 * 
 * Strategy:
 * 1. Lock rows atomically via RPC (prevents double-withdraw)
 * 2. Generate a single batch_id for traceability
 * 3. FIFO allocation of bags across records
 * 4. Proportional rent/discount/payment distribution
 * 5. Auto-settle hamali on fully closed records
 * 6. Save transactions with batch_id linkage
 */
export async function processBulkOutflow(_prevState: any, formData: FormData): Promise<BulkOutflowResult> {
    return Sentry.startSpan(
        {
            op: "function",
            name: "processBulkOutflow",
        },
        async (_span) => {
            const rawData = {
                customerId: formData.get('customerId'),
                commodity: formData.get('commodity'),
                totalBagsToWithdraw: formData.get('totalBagsToWithdraw'),
                withdrawalDate: formData.get('withdrawalDate'),
                finalRent: formData.get('finalRent'),
                discount: formData.get('discount'),
                amountPaidNow: formData.get('amountPaidNow'),
                sendSms: formData.get('sendSms') === 'true',
                specificRecordIds: formData.get('specificRecordIds'),
                recordAllocations: formData.get('recordAllocations') as string || undefined,
            };

            const customerId = rawData.customerId as string;
            await checkRateLimit(customerId || 'anon', 'bulkOutflow', { limit: 5 });

            const validatedFields = BulkOutflowSchema.safeParse(rawData);

            if (!validatedFields.success) {
                const error = validatedFields.error.flatten().fieldErrors;
                const message = Object.values(error).flat().join(', ');
                return { success: false, message: `Invalid data: ${message}` };
            }

            const {
                customerId: validCustomerId,
                commodity,
                totalBagsToWithdraw,
                withdrawalDate,
                amountPaidNow,
                discount,
                sendSms,
                specificRecordIds,
                recordAllocations: recordAllocationsJson
            } = validatedFields.data;

            // Parse manual per-record allocations if provided
            let manualAllocations: { recordId: string; bags: number }[] | null = null;
            if (recordAllocationsJson) {
                try {
                    manualAllocations = JSON.parse(recordAllocationsJson);
                } catch {
                    return { success: false, message: 'Invalid record allocations format.' };
                }
            }

            const supabase = await createClient();
            const warehouseId = await getUserWarehouse();
            if (!warehouseId) {
                return { success: false, message: 'No warehouse found for user.' };
            }

            // --- STEP 1: Atomic stock reservation via RPC (row-level locking) ---
            let specificIds: string[] | null = null;
            if (specificRecordIds) {
                specificIds = specificRecordIds.split(',').filter(Boolean);
                if (specificIds.length === 0) specificIds = null;
            }

            try {
                // The RPC function locks rows with SELECT ... FOR UPDATE
                // to prevent concurrent bulk outflows from double-withdrawing
                const { data: lockedRecords, error: lockError } = await supabase.rpc(
                    'reserve_stock_for_bulk_outflow',
                    {
                        p_customer_id: validCustomerId,
                        p_commodity: commodity,
                        p_bags_needed: totalBagsToWithdraw,
                        p_specific_ids: specificIds
                    }
                );

                if (lockError) {
                    // RPC raises exception if insufficient stock
                    if (lockError.message.includes('Insufficient stock')) {
                        return { success: false, message: lockError.message };
                    }
                    throw lockError;
                }

                if (!lockedRecords || lockedRecords.length === 0) {
                    return { success: false, message: 'No active records found for this commodity (or selection).' };
                }

                // --- STEP 2: Batch-load full records for billing calculations ---
                const lockedIds = lockedRecords.map((lr: any) => lr.record_id);
                const batchRecords = await Promise.all(lockedIds.map((id: string) => getStorageRecord(id)));
                const activeRecords: StorageRecord[] = batchRecords.filter(
                    (r): r is StorageRecord => r !== null && r.bagsStored > 0
                );

                if (activeRecords.length === 0) {
                    return { success: false, message: 'No records with available stock found.' };
                }

                // --- STEP 2.5: Load crop pricing for per-commodity rates ---
                const cropIds = [...new Set(activeRecords.map(r => r.cropId).filter(Boolean))];
                const cropPricingMap: Record<string, { price6m: number; price1y: number; pricingSlabs?: any }> = {};
                if (cropIds.length > 0) {
                    const { data: crops } = await supabase
                        .from('crops')
                        .select('id, rent_price_6m, rent_price_1y, pricing_slabs')
                        .in('id', cropIds);
                    if (crops) {
                        for (const crop of crops) {
                            cropPricingMap[crop.id] = {
                                price6m: crop.rent_price_6m,
                                price1y: crop.rent_price_1y,
                                pricingSlabs: crop.pricing_slabs
                            };
                        }
                    }
                }

                // --- STEP 3: Allocation Plan (Manual or FIFO) ---
                const operations = [];

                if (manualAllocations && manualAllocations.length > 0) {
                    // Manual per-record allocation
                    for (const alloc of manualAllocations) {
                        if (alloc.bags <= 0) continue;
                        const record = activeRecords.find(r => r.id === alloc.recordId);
                        if (!record) {
                            return { success: false, message: `Record ${alloc.recordId} not found or not available.` };
                        }
                        if (alloc.bags > record.bagsStored) {
                            return { success: false, message: `Cannot withdraw ${alloc.bags} bags from record #${record.recordNumber} (only ${record.bagsStored} available).` };
                        }
                        const cropData = record.cropId ? cropPricingMap[record.cropId] : undefined;
                        const { rent: recordRent } = BillingService.calculateRent(
                            record,
                            new Date(withdrawalDate),
                            alloc.bags,
                            cropData ? { price6m: cropData.price6m, price1y: cropData.price1y } : undefined,
                            cropData?.pricingSlabs
                        );
                        operations.push({ record, bags: alloc.bags, rent: recordRent });
                    }
                } else {
                    // Default FIFO allocation
                    let bagsRemainingToWithdraw = totalBagsToWithdraw;
                    for (const record of activeRecords) {
                        if (bagsRemainingToWithdraw <= 0) break;
                        const bagsFromThisRecord = Math.min(record.bagsStored, bagsRemainingToWithdraw);
                        const cropData = record.cropId ? cropPricingMap[record.cropId] : undefined;
                        const { rent: recordRent } = BillingService.calculateRent(
                            record,
                            new Date(withdrawalDate),
                            bagsFromThisRecord,
                            cropData ? { price6m: cropData.price6m, price1y: cropData.price1y } : undefined,
                            cropData?.pricingSlabs
                        );
                        operations.push({ record, bags: bagsFromThisRecord, rent: recordRent });
                        bagsRemainingToWithdraw -= bagsFromThisRecord;
                    }
                }

                // --- STEP 4: Execute Operations ---
                const withdrawalDateObj = new Date(withdrawalDate);

                // Generate ONE batch_id for the entire bulk operation
                const batchId = crypto.randomUUID();
                const batchPrefix = batchId.slice(0, 8);

                // Generate ONE consolidated invoice number for the entire batch.
                // Every withdrawal_transactions row in this batch carries this
                // number — that's how the bill renderer + statement grouping
                // identify which withdrawals belong to one consolidated bill.
                const consolidatedInvoiceNo = await getNextInvoiceNumber('outflow');

                const totalBatchRent = operations.reduce((sum, op) => sum + op.rent, 0);
                let paymentRemaining = amountPaidNow || 0;
                let discountRemaining = discount || 0;

                // Build the full per-record plan here in JS (all billing math stays
                // where it is unit-tested), then hand the whole plan to ONE atomic
                // RPC that performs every write in a single transaction. This makes
                // bulk outflow all-or-nothing: no more partial saves / orphaned
                // auto-settle payments if something fails mid-batch.
                type OpPayment = { amount: number; type: 'rent' | 'hamali' | 'insurance'; notes: string };
                const batchOperations = operations.map((op, idx) => {
                    const { record, bags, rent } = op;
                    const isLast = idx === operations.length - 1;

                    // 1. Allocate discount proportionally
                    let allocatedDiscount = 0;
                    if (totalBatchRent > 0 && discountRemaining > 0) {
                        allocatedDiscount = Math.round((rent / totalBatchRent) * (discount || 0) * 100) / 100;
                        if (allocatedDiscount > discountRemaining || isLast) allocatedDiscount = discountRemaining;
                        discountRemaining -= allocatedDiscount;
                    } else if (discountRemaining > 0 && totalBatchRent === 0) {
                        allocatedDiscount = discountRemaining;
                        discountRemaining = 0;
                    }
                    const rentAfterDiscount = Math.max(0, rent - allocatedDiscount);

                    // 2. Allocate payment proportionally
                    let allocatedPayment = 0;
                    if (totalBatchRent > 0 && paymentRemaining > 0) {
                        allocatedPayment = Math.round((rent / totalBatchRent) * (amountPaidNow || 0) * 100) / 100;
                        if (allocatedPayment > paymentRemaining || isLast) allocatedPayment = paymentRemaining;
                        paymentRemaining -= allocatedPayment;
                    } else if (paymentRemaining > 0 && totalBatchRent === 0) {
                        allocatedPayment = paymentRemaining;
                        paymentRemaining = 0;
                    }

                    // 3. Record impact (new bag counts / closure)
                    const { updates: recordUpdate, isClosed } = BillingService.calculateOutflowImpact(
                        record, bags, rentAfterDiscount, withdrawalDateObj
                    );

                    const opPayments: OpPayment[] = [];
                    if (allocatedPayment > 0) {
                        opPayments.push({ amount: allocatedPayment, type: 'rent', notes: `Bulk Outflow Payment (Batch: ${batchPrefix})` });
                    }

                    // 4. Auto-settle outstanding hamali on full closure
                    let hamaliCharged = 0;
                    if (isClosed && record.hamaliPayable && record.hamaliPayable > 0) {
                        const hamaliPaid = (record.payments || []).filter(p => p.type === 'hamali').reduce((s, p) => s + p.amount, 0);
                        const hamaliDue = Math.max(0, record.hamaliPayable - hamaliPaid);
                        if (hamaliDue > 0) {
                            hamaliCharged = hamaliDue;
                            opPayments.push({ amount: hamaliDue, type: 'hamali', notes: `Hamali auto-settled on record closure (Batch: ${batchPrefix})` });
                        }
                    }

                    // 4b. Auto-settle outstanding insurance on full closure (mirrors hamali)
                    let insuranceCharged = 0;
                    if (isClosed && record.insurancePayable && record.insurancePayable > 0) {
                        const insurancePaid = (record.payments || []).filter(p => p.type === 'insurance').reduce((s, p) => s + p.amount, 0);
                        const insuranceDue = Math.max(0, record.insurancePayable - insurancePaid);
                        if (insuranceDue > 0) {
                            insuranceCharged = insuranceDue;
                            opPayments.push({ amount: insuranceDue, type: 'insurance', notes: `Insurance auto-settled on record closure (Batch: ${batchPrefix})` });
                        }
                    }

                    return {
                        record_id: record.id,
                        bags_withdrawn: bags,
                        rent_collected: rentAfterDiscount,
                        discount: allocatedDiscount,
                        hamali_charged: hamaliCharged,
                        insurance_charged: insuranceCharged,
                        new_bags_stored: recordUpdate.bagsStored ?? 0,
                        new_bags_out: recordUpdate.bagsOut ?? 0,
                        new_total_rent_billed: recordUpdate.totalRentBilled ?? 0,
                        storage_end_date: recordUpdate.storageEndDate
                            ? new Date(recordUpdate.storageEndDate).toISOString()
                            : null,
                        payments: opPayments,
                    };
                });

                // --- STEP 4: Execute EVERY write atomically (all-or-nothing) ---
                const { data: rpcResult, error: rpcError } = await supabase.rpc('process_bulk_outflow_atomic', {
                    p_warehouse_id: warehouseId,
                    p_batch_id: batchId,
                    p_consolidated_invoice_no: consolidatedInvoiceNo,
                    p_withdrawal_date: withdrawalDate,
                    p_operations: batchOperations,
                });
                if (rpcError) throw rpcError;
                if (!rpcResult?.success) {
                    throw new Error(rpcResult?.error || rpcResult?.message || 'Bulk outflow write failed');
                }
                const transactionIds: string[] = rpcResult.transaction_ids || [];
                const processedCount: number = rpcResult.processed_count || 0;
                logger.info("Bulk outflow committed atomically", { batchId, processedCount, consolidatedInvoiceNo });

                // --- STEP 6: SMS Notification ---
                // Records are already withdrawn and saved above. SMS is a
                // best-effort side effect — never let it fail the whole outflow
                // (which would show an error to the user despite the data being
                // written, and tempt a retry that double-withdraws).
                try {
                    // Master switch gates the direct send too (bulk uses textBeeService directly).
                    if (sendSms && transactionIds.length > 0 && (await isSMSMasterEnabled())) {
                         const customer = await getCustomer(validCustomerId);

                         if (customer && customer.phone) {
                             const { textBeeService } = await import('@/lib/textbee');

                             const message = `Bulk Outflow Processed
Item: ${commodity}
Total Bags: ${totalBagsToWithdraw}
Rent: ${totalBatchRent > 0 ? 'Rs.' + totalBatchRent.toLocaleString('en-IN') : 'N/A'}
Paid: ${amountPaidNow && amountPaidNow > 0 ? 'Rs.' + amountPaidNow.toLocaleString('en-IN') : 'Rs.0'}
Thank you.`;

                             await textBeeService.sendSMS({
                                 to: customer.phone,
                                 message
                             });
                             logger.info("Bulk outflow SMS sent", { customerId, phone: customer.phone, batchId });
                         } else {
                             logger.warn("Skipping SMS: Customer phone not found", { customerId });
                         }
                    }
                } catch (smsErr: any) {
                    logError(smsErr, { operation: 'processBulkOutflow:SMS', metadata: { customerId, batchId } });
                }

                revalidatePath('/storage');
                revalidatePath('/customers');
                revalidatePath(`/customers/${customerId}`);

                return {
                    success: true,
                    message: `Successfully processed outflow for ${processedCount} records (${totalBagsToWithdraw} bags). Bill #${consolidatedInvoiceNo}.`,
                    processedCount,
                    transactionIds,
                    batchId,
                    consolidatedInvoiceNo
                };

            } catch (err: any) {
                logError(err, {
                    operation: 'processBulkOutflow',
                    userId: 'unknown',
                    metadata: {
                         customerId,
                         totalBagsToWithdraw,
                    }
                });
                return { success: false, message: `Bulk processing failed: ${err.message}` };
            }
        }
    );
}
