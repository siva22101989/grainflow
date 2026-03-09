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
});

export type BulkOutflowResult = {
    success: boolean;
    message: string;
    processedCount?: number;
    transactionIds?: string[];
};

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
            };

            const customerId = rawData.customerId as string;
            await checkRateLimit(customerId || 'anon', 'bulkOutflow', { limit: 5 }); // Stricter limit for bulk ops

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
                specificRecordIds 
            } = validatedFields.data;

            const supabase = await createClient();

            // 1. Fetch active records
            let query = supabase
                .from('storage_records')
                .select('*')
                .eq('customer_id', validCustomerId)
                .eq('commodity_description', commodity)
                .is('storage_end_date', null)
                .gt('bags_stored', 0);

            // Apply manual selection filter if provided
            if (specificRecordIds) {
                const ids = specificRecordIds.split(',').filter(Boolean);
                if (ids.length > 0) {
                    query = query.in('id', ids);
                }
            }

            // Always sort FIFO (Oldest first) within the selected set
            const { data: records, error } = await query.order('storage_start_date', { ascending: true });

            if (error || !records || records.length === 0) {
                return { success: false, message: 'No active records found for this commodity (or selection).' };
            }

            // Map to our app type and filter out any where actual stock is 0
            // (The DB query above might select them if the bags_stored DB column is corrupt)
            const resolvedRecords = await Promise.all(records.map(async (r) => {
                 return await getStorageRecord(r.id) as StorageRecord;
            }));
            const activeRecords = resolvedRecords.filter(r => r && r.bagsStored > 0);

            // 2. Validate total available
            const totalAvailable = activeRecords.reduce((sum, r) => sum + r.bagsStored, 0);
            if (activeRecords.length === 0) {
                 return { success: false, message: 'No records with available stock found for this commodity (or selection).' };
            }
            if (totalBagsToWithdraw > totalAvailable) {
                 return { success: false, message: `Requested ${totalBagsToWithdraw} bags, but only ${totalAvailable} are available.` };
            }

            // 3. FIFO Allocation Plan
            let bagsRemainingToWithdraw = totalBagsToWithdraw;
            const operations = [];

            for (const record of activeRecords) {
                if (bagsRemainingToWithdraw <= 0) break;

                const bagsFromThisRecord = Math.min(record.bagsStored, bagsRemainingToWithdraw);
                
                // Calculate rent proportion for this specific record
                // We assume the frontend passed a "Total Rent" that might be a sum of estimates, 
                // OR we calculate exact rent per record here. 
                // BETTER: Calculate exact rent per record here based on actual bags withdrawn.
                const { rent: recordRent } = BillingService.calculateRent(
                    record, 
                    new Date(withdrawalDate), 
                    bagsFromThisRecord
                );

                operations.push({
                    record,
                    bags: bagsFromThisRecord,
                    rent: recordRent
                });

                bagsRemainingToWithdraw -= bagsFromThisRecord;
            }

            // 4. Execute Operations
            let processedCount = 0;
            const transactionIds: string[] = [];
            const withdrawalDateObj = new Date(withdrawalDate);
            
            // Generate ONE invoice number for the whole batch if possible, or one per record?
            // Existing schema stores 'outflow_invoice_no' on storage_record. 
            // So if we fully close a record, it gets an invoice number.
            // If we partially close, it might get one too? 
            // Usually invoice number is per "Bill". 
            // Let's generate a unique group ID or just use individual updates for now to be safe.
            // We will generate a new Invoice Number for EACH record update to keep them distinct/trackable, 
            // OR we can try to share it if business logic permits. 
            // For now, let's keep it simple: One Invoice Number per updated record (standard flow).
            
            try {
                // Distribute payment proportionally? Or just apply to the first/last?
                // Applying proportionally is fairest.
                // Total Rent for the batch:
                const totalBatchRent = operations.reduce((sum, op) => sum + op.rent, 0);
                let paymentRemaining = amountPaidNow || 0;
                let discountRemaining = discount || 0;

                for (const op of operations) {
                    const { record, bags, rent } = op;
                    
                    // 1. Allocate Discount
                    let allocatedDiscount = 0;
                    if (totalBatchRent > 0 && discountRemaining > 0) {
                         allocatedDiscount = (rent / totalBatchRent) * (discount || 0);
                         allocatedDiscount = Math.round(allocatedDiscount * 100) / 100;
                         // Prevent floating point overshoot and apply remainder to the final op
                         if (allocatedDiscount > discountRemaining || op === operations[operations.length - 1]) {
                             allocatedDiscount = discountRemaining;
                         }
                         discountRemaining -= allocatedDiscount;
                    } else if (discountRemaining > 0 && totalBatchRent === 0) {
                        allocatedDiscount = discountRemaining;
                        discountRemaining = 0;
                    }

                    const rentAfterDiscount = Math.max(0, rent - allocatedDiscount);

                    // 2. Allocate Payment
                    // Simple proportion for payment allocation: (This Record Rent / Total Batch Rent) * Total Payment
                    // Safeguard against division by zero
                    let allocatedPayment = 0;
                    if (totalBatchRent > 0 && paymentRemaining > 0) {
                         allocatedPayment = (rent / totalBatchRent) * (amountPaidNow || 0);
                         // Round to 2 decimals
                         allocatedPayment = Math.round(allocatedPayment * 100) / 100;
                         // Prevent floating point overshoot
                         if (allocatedPayment > paymentRemaining || op === operations[operations.length - 1]) {
                             allocatedPayment = paymentRemaining;
                         }
                         paymentRemaining -= allocatedPayment;
                    } else if (paymentRemaining > 0 && totalBatchRent === 0) {
                        // If no rent due (e.g. grace period), just dump payment into the first record?
                        // Or spread evenly by bags?
                        allocatedPayment = paymentRemaining; // Just put it all on the first one that fits
                        paymentRemaining = 0; // consumed
                    }

                    // Calculate impact
                    const { updates: recordUpdate } = BillingService.calculateOutflowImpact(
                        record,
                        bags,
                        rentAfterDiscount, // Use calculated rent (after discount) for this slice
                        withdrawalDateObj
                    );

                    // Apply Payment
                    if (allocatedPayment > 0) {
                        await addPaymentToRecord(record.id, {
                            amount: allocatedPayment,
                            date: withdrawalDateObj,
                            type: 'rent',
                            notes: 'Bulk Outflow Payment'
                        });
                        logger.info("Payment added during bulk outflow", { recordId: record.id, amount: allocatedPayment });
                    }

                    // Invoice Number
                    if (!record.outflowInvoiceNo) {
                        // @ts-ignore
                        recordUpdate.outflow_invoice_no = await getNextInvoiceNumber('outflow');
                    }

                    // Update Record
                    await updateStorageRecord(record.id, recordUpdate);

                    // Save Transaction
                    const txId = await saveWithdrawalTransaction(record.id, bags, withdrawalDateObj, rentAfterDiscount, allocatedDiscount);
                    if (txId) transactionIds.push(txId);

                    processedCount++;
                }

                if (sendSms && transactionIds.length > 0) {
                     // Need customer phone
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
                         logger.info("Bulk outflow SMS sent", { customerId, phone: customer.phone });
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
                    transactionIds
                };

            } catch (err: any) {
                logError(err, {
                    operation: 'processBulkOutflow',
                    userId: 'unknown', // Server Action context usually has access to auth.uid() upstream, but here we can rely on error-logger to extract from Sentry context or pass explicit if available.
                    metadata: {
                         customerId,
                         totalBagsToWithdraw,
                         processedCount
                    }
                });
                return { success: false, message: `Bulk processing failed: ${err.message}` };
            }
        }
    );
}
