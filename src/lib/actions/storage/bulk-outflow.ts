'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import * as Sentry from "@sentry/nextjs";

import { createClient } from '@/utils/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getNextInvoiceNumber } from '@/lib/sequence-utils';
import { logError } from '@/lib/error-logger';
import { BillingService } from '@/lib/billing';
import { updateStorageRecord, addPaymentToRecord, saveWithdrawalTransaction } from '@/lib/data';
import type { StorageRecord } from '@/lib/definitions';
import { getStorageRecord, getCustomer } from '@/lib/queries';

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
};

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

                // --- STEP 2: Load full records for billing calculations ---
                const activeRecords: StorageRecord[] = [];
                for (const lr of lockedRecords) {
                    const record = await getStorageRecord(lr.record_id);
                    if (record && record.bagsStored > 0) {
                        activeRecords.push(record);
                    }
                }

                if (activeRecords.length === 0) {
                    return { success: false, message: 'No records with available stock found.' };
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
                        const { rent: recordRent } = BillingService.calculateRent(
                            record,
                            new Date(withdrawalDate),
                            alloc.bags
                        );
                        operations.push({ record, bags: alloc.bags, rent: recordRent });
                    }
                } else {
                    // Default FIFO allocation
                    let bagsRemainingToWithdraw = totalBagsToWithdraw;
                    for (const record of activeRecords) {
                        if (bagsRemainingToWithdraw <= 0) break;
                        const bagsFromThisRecord = Math.min(record.bagsStored, bagsRemainingToWithdraw);
                        const { rent: recordRent } = BillingService.calculateRent(
                            record,
                            new Date(withdrawalDate),
                            bagsFromThisRecord
                        );
                        operations.push({ record, bags: bagsFromThisRecord, rent: recordRent });
                        bagsRemainingToWithdraw -= bagsFromThisRecord;
                    }
                }

                // --- STEP 4: Execute Operations ---
                let processedCount = 0;
                const transactionIds: string[] = [];
                const withdrawalDateObj = new Date(withdrawalDate);
                
                // Generate ONE batch_id for the entire bulk operation
                const batchId = crypto.randomUUID();
                
                const totalBatchRent = operations.reduce((sum, op) => sum + op.rent, 0);
                let paymentRemaining = amountPaidNow || 0;
                let discountRemaining = discount || 0;

                for (const op of operations) {
                    const { record, bags, rent } = op;
                    
                    // 1. Allocate Discount proportionally
                    let allocatedDiscount = 0;
                    if (totalBatchRent > 0 && discountRemaining > 0) {
                         allocatedDiscount = (rent / totalBatchRent) * (discount || 0);
                         allocatedDiscount = Math.round(allocatedDiscount * 100) / 100;
                         if (allocatedDiscount > discountRemaining || op === operations[operations.length - 1]) {
                             allocatedDiscount = discountRemaining;
                         }
                         discountRemaining -= allocatedDiscount;
                    } else if (discountRemaining > 0 && totalBatchRent === 0) {
                        allocatedDiscount = discountRemaining;
                        discountRemaining = 0;
                    }

                    const rentAfterDiscount = Math.max(0, rent - allocatedDiscount);

                    // 2. Allocate Payment proportionally
                    let allocatedPayment = 0;
                    if (totalBatchRent > 0 && paymentRemaining > 0) {
                         allocatedPayment = (rent / totalBatchRent) * (amountPaidNow || 0);
                         allocatedPayment = Math.round(allocatedPayment * 100) / 100;
                         if (allocatedPayment > paymentRemaining || op === operations[operations.length - 1]) {
                             allocatedPayment = paymentRemaining;
                         }
                         paymentRemaining -= allocatedPayment;
                    } else if (paymentRemaining > 0 && totalBatchRent === 0) {
                        allocatedPayment = paymentRemaining;
                        paymentRemaining = 0;
                    }

                    // Calculate impact
                    const { updates: recordUpdate, isClosed } = BillingService.calculateOutflowImpact(
                        record,
                        bags,
                        rentAfterDiscount,
                        withdrawalDateObj
                    );

                    // Apply Rent Payment
                    if (allocatedPayment > 0) {
                        await addPaymentToRecord(record.id, {
                            amount: allocatedPayment,
                            date: withdrawalDateObj,
                            type: 'rent',
                            notes: `Bulk Outflow Payment (Batch: ${batchId.slice(0, 8)})`
                        });
                        logger.info("Payment added during bulk outflow", { recordId: record.id, amount: allocatedPayment, batchId });
                    }

                    // --- STEP 5: Auto-settle hamali on fully closed records ---
                    let hamaliCharged = 0;
                    if (isClosed && record.hamaliPayable && record.hamaliPayable > 0) {
                        // Calculate outstanding hamali
                        const hamaliPaid = (record.payments || [])
                            .filter(p => p.type === 'hamali')
                            .reduce((sum, p) => sum + p.amount, 0);
                        const hamaliDue = Math.max(0, record.hamaliPayable - hamaliPaid);
                        
                        if (hamaliDue > 0) {
                            // Generate separate hamali payment entry (Option B)
                            await addPaymentToRecord(record.id, {
                                amount: hamaliDue,
                                date: withdrawalDateObj,
                                type: 'hamali',
                                notes: `Hamali auto-settled on record closure (Batch: ${batchId.slice(0, 8)})`
                            });
                            hamaliCharged = hamaliDue;
                            logger.info("Hamali auto-settled during bulk outflow", { 
                                recordId: record.id, 
                                hamaliDue, 
                                batchId 
                            });
                        }
                    }

                    // Invoice Number - individual per record (Option B)
                    if (!record.outflowInvoiceNo) {
                        // @ts-ignore
                        recordUpdate.outflow_invoice_no = await getNextInvoiceNumber('outflow');
                    }

                    // Update Record
                    await updateStorageRecord(record.id, recordUpdate);

                    // Save Transaction with batch_id and hamali tracking
                    const txId = await saveWithdrawalTransaction(
                        record.id, 
                        bags, 
                        withdrawalDateObj, 
                        rentAfterDiscount, 
                        allocatedDiscount,
                        { batchId, hamaliCharged }
                    );
                    if (txId) transactionIds.push(txId);

                    processedCount++;
                }

                // --- STEP 6: SMS Notification ---
                if (sendSms && transactionIds.length > 0) {
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

                revalidatePath('/storage');
                revalidatePath('/customers');
                revalidatePath(`/customers/${customerId}`);

                return { 
                    success: true, 
                    message: `Successfully processed outflow for ${processedCount} records (${totalBagsToWithdraw} bags).`,
                    processedCount,
                    transactionIds,
                    batchId
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
