'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { startOfDay } from 'date-fns';
import * as Sentry from "@sentry/nextjs";

import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/lib/queries/auth'; // Import for rate limiting
import { getStorageRecord, getCustomer } from '@/lib/queries';
import { updateStorageRecord, addPaymentToRecord, saveWithdrawalTransaction } from '@/lib/data';
import { checkRateLimit } from '@/lib/rate-limit';
import { getNextInvoiceNumber } from '@/lib/sequence-utils';
import { logError, logWarning, formatActionError } from '@/lib/error-logger';
import { BillingService } from '@/lib/billing';


const { logger } = Sentry;

const OutflowSchema = z.object({
    recordId: z.string().min(1, 'A storage record must be selected.'),
    bagsToWithdraw: z.coerce.number().int().positive('Bags to withdraw must be a positive number.'),
    withdrawalDate: z.string().refine(val => {
        const date = new Date(val);
        return !isNaN(date.getTime()) && date <= new Date();
    }, { message: "Date cannot be in the future" }),
    finalRent: z.coerce.number().nonnegative('Final rent cannot be negative.'),
    discount: z.coerce.number().nonnegative('Discount cannot be negative.').optional(),
    amountPaidNow: z.coerce.number().nonnegative('Amount paid must be non-negative.').optional(),
});

export type OutflowFormState = {
    message: string;
    success: boolean;
    data?: Record<string, any>;
};

/**
 * Core server action to record an outflow (withdrawal) of stock for a single storage record.
 * Handles validation, stock checks, rent calculation impact, payment recording, and auditing.
 * 
 * @param {OutflowFormState} _prevState - Form state (provided by useActionState).
 * @param {FormData} formData - Form data containing recordId, bagsToWithdraw, withdrawalDate, finalRent, amountPaidNow, etc.
 * @returns {Promise<OutflowFormState>} The result of the operation, containing success status and message.
 */
export async function addOutflow(_prevState: OutflowFormState, formData: FormData): Promise<OutflowFormState> {
    return Sentry.startSpan(
        {
            op: "function",
            name: "addOutflow",
        },
        async (span) => {
            const rawData = {
                recordId: formData.get('recordId'),
                bagsToWithdraw: formData.get('bagsToWithdraw'),
                withdrawalDate: formData.get('withdrawalDate'),
                finalRent: formData.get('finalRent'),
                discount: formData.get('discount'),
                amountPaidNow: formData.get('amountPaidNow'),
            };
            const recordIdForLimit = rawData.recordId as string;
            await checkRateLimit(recordIdForLimit || 'anon', 'addOutflow', { limit: 10 });
            span.setAttribute("recordId", recordIdForLimit);

            const validatedFields = OutflowSchema.safeParse(rawData);

            if (!validatedFields.success) {
                const error = validatedFields.error.flatten().fieldErrors;
                const message = Object.values(error).flat().join(', ');
                logWarning("Outflow validation failed", { operation: 'addOutflow', metadata: { errors: error } });
                return { message: `Invalid data: ${message}`, success: false, data: rawData };
            }
            
            const { recordId, bagsToWithdraw, withdrawalDate, finalRent, discount, amountPaidNow } = validatedFields.data;
            span.setAttribute("bagsToWithdraw", bagsToWithdraw);
            
            const originalRecord = await getStorageRecord(recordId);

            if (!originalRecord) {
                logError(new Error("Storage record not found for outflow"), { operation: 'addOutflow', metadata: { recordId } });
                return { message: 'Record not found.', success: false, data: rawData };
            }

            const currentStock = originalRecord.bagsIn - originalRecord.bagsOut;
            if (bagsToWithdraw > currentStock) {
                logWarning("Attempted to withdraw more bags than available", { operation: 'addOutflow', metadata: { recordId, available: currentStock, requested: bagsToWithdraw } });
                return { message: `Cannot withdraw more bags than are in storage. (Available: ${currentStock})`, success: false, data: rawData };
            }

            // Compare dates only (ignore time) to allow same-day withdrawals
            if (startOfDay(new Date(withdrawalDate)) < startOfDay(new Date(originalRecord.storageStartDate))) {
                 return { message: 'Withdrawal date cannot be before storage start date.', success: false, data: rawData };
            }

            const paymentMade = amountPaidNow || 0;
            const discountAmount = discount || 0;

            // Server-side rent recalculation (don't trust client-calculated rent)
            // Look up crop pricing for accurate per-commodity rates
            let serverRent = finalRent;
            if (originalRecord.cropId) {
                const supabase = await createClient();
                const { data: crop } = await supabase
                    .from('crops')
                    .select('rent_price_6m, rent_price_1y, pricing_slabs')
                    .eq('id', originalRecord.cropId)
                    .single();
                if (crop) {
                    const { rent: recalculated } = BillingService.calculateRent(
                        originalRecord,
                        new Date(withdrawalDate),
                        bagsToWithdraw,
                        { price6m: crop.rent_price_6m, price1y: crop.rent_price_1y },
                        crop.pricing_slabs
                    );
                    serverRent = recalculated;
                }
            }

            const { updates: recordUpdate } = BillingService.calculateOutflowImpact(
                originalRecord,
                bagsToWithdraw,
                serverRent,
                new Date(withdrawalDate)
            );

            try {
                if (paymentMade > 0) {
                    await addPaymentToRecord(recordId, { 
                        amount: paymentMade, 
                        date: new Date(withdrawalDate), 
                        type: 'rent',
                        notes: 'Rent paid during outflow' 
                    });
                    logger.info("Payment added during outflow", { recordId, amount: paymentMade });
                }

                // Generate Outflow Invoice Number if not present (First Outflow)
                if (!originalRecord.outflowInvoiceNo) {
                    // @ts-ignore - Field exists in DB
                    recordUpdate.outflow_invoice_no = await getNextInvoiceNumber('outflow'); 
                }
                
                await updateStorageRecord(recordId, recordUpdate);

                // Update Lot Capacity Manually (Reliability Fix) - REMOVED
                // Manual update is redundant because 'updateStorageRecord' above
                // triggers 'sync_lot_stock' in the database, which recalculates stock.
                // Keeping two sources of truth causes sync issues.

                // Save Withdrawal Transaction Audit
                const transactionId = await saveWithdrawalTransaction(recordId, bagsToWithdraw, new Date(withdrawalDate), serverRent, discountAmount);

                // Send SMS Notification
                const sendSms = formData.get('sendSms') === 'true';
                if (transactionId && sendSms) {
                    const { sendOutflowConfirmationSMS } = await import('@/lib/sms-event-actions');
                    await sendOutflowConfirmationSMS(transactionId, true);
                }

                const { createNotification } = await import('@/lib/logger');
                
                // Fetch customer for notification readability
                const customer = await getCustomer(originalRecord.customerId);
                const customerName = customer?.name || 'Unknown';

                await createNotification(
                    'Outflow Recorded', 
                    `Withdrawn ${bagsToWithdraw} bags (${originalRecord.commodityDescription}) for ${customerName}`, 
                    'info',
                    'outflow',
                    undefined, 
                    `/outflow/receipt/${recordId}`
                );

                logger.info("Outflow recorded successfully", { recordId, bagsOut: bagsToWithdraw });
                revalidatePath('/storage');
                revalidatePath('/reports');
                revalidatePath('/financials');
                revalidatePath('/customers'); // Stock changes affect list via 'Active Bags'
                if (originalRecord.customerId) {
                     revalidatePath(`/customers/${originalRecord.customerId}`);
                }
            } catch (error: any) {
                logError(error, {
                    operation: 'addOutflow',
                    metadata: { recordId, bagsToWithdraw }
                });
                return { message: formatActionError(error, "Failed to save outflow transaction."), success: false, data: rawData };
            }
            redirect(`/outflow/receipt/${recordId}?withdrawn=${bagsToWithdraw}&rent=${finalRent}&paidNow=${paymentMade}`);
        }
    );
}

/**
 * Soft-deletes (reverts) a specific outflow transaction.
 * Restores the withdrawn bags back to the storage record, reverses the billed rent,
 * and reopens the record if it was previously marked as completed.
 * 
 * @param {string} transactionId - The UUID of the `withdrawal_transactions` row to revert.
 * @returns {Promise<{ success: boolean, message: string }>} Result of the reversal operation.
 */
export async function deleteOutflow(transactionId: string) {
    const user = await getAuthUser();
    await checkRateLimit(user?.id || 'anon', 'deleteOutflow', { limit: 10 });
    
    const supabase = await createClient();
    
    // 1. Get Transaction
    const { data: transaction, error: txError } = await supabase
        .from('withdrawal_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();
    
    if (txError || !transaction) {
        return { success: false, message: 'Transaction not found' };
    }


    // If not, use storage_record if joined. But we want fresh CamelCase.
    // Let's assume record_id is on transaction table. (Check step 2374: select * includes record_id?)
    // data.ts: saveWithdrawalTransaction uses .insert({ storage_record_id: recordId ... })
    // So column is likely `storage_record_id`.
    
    const storageRecordId = transaction.storage_record_id;

    if (!storageRecordId) {
        return { success: false, message: 'Transaction has no record ID' };
    }

    const record = await getStorageRecord(storageRecordId);
    if (!record) {
         return { success: false, message: 'Associated storage record not found' };
    }

    // 2. Prepare Updates via Service
    const bagsRestored = transaction.bags_withdrawn;
    const rentReversed = transaction.rent_collected || 0;

    const { updates, shouldReopen } = BillingService.calculateReversalImpact(record, bagsRestored, rentReversed);

    // 3. Reverse everything atomically: restore the record, soft-delete the
    //    withdrawal, AND soft-delete the payments this outflow created (rent paid
    //    + auto-settled hamali/insurance). Doing it in one RPC prevents a delete
    //    from half-reverting (e.g. bags restored but auto-settle payments left
    //    behind, which inflated the customer's paid total).
    const { data: rpcResult, error: rpcError } = await supabase.rpc('reverse_outflow_atomic', {
        p_transaction_id: transactionId,
        p_new_bags_stored: updates.bagsStored ?? record.bagsStored,
        p_new_bags_out: updates.bagsOut ?? 0,
        p_new_total_rent_billed: updates.totalRentBilled ?? 0,
        p_reopen: shouldReopen,
    });

    if (rpcError || !rpcResult?.success) {
        logError(rpcError || new Error(rpcResult?.error || 'reverse failed'), {
            operation: 'deleteOutflow_revert', metadata: { recordId: record.id, transactionId }
        });
        return { success: false, message: `Failed to revert outflow: ${rpcError?.message || rpcResult?.error || 'unknown error'}` };
    }

    revalidatePath('/outflow');
    revalidatePath('/storage');
    revalidatePath('/financials');
    revalidatePath('/reports');
    revalidatePath('/customers');

    if (record.customerId) {
        revalidatePath(`/customers/${record.customerId}`);
    }
    
    return { success: true, message: 'Outflow reverted successfully.' };
}

/**
 * Modifies an existing outflow transaction's details (bags, rent, date).
 * Re-calculates the final impact on the storage record (e.g. adjusting stock).
 * 
 * @param {string} transactionId - The UUID of the transaction to update.
 * @param {FormData} formData - Data containing the corrected `bags`, `date`, and `rent`.
 * @returns {Promise<{ success: boolean, message: string }>} Result of the update operation.
 */
export async function updateOutflow(transactionId: string, formData: FormData) {
    const user = await getAuthUser();
    await checkRateLimit(user?.id || 'anon', 'updateOutflow', { limit: 10 });

    const supabase = await createClient();
    
    const bags = parseInt(formData.get('bags') as string);
    const date = formData.get('date') as string;
    const rent = parseFloat(formData.get('rent') as string);

    if (isNaN(bags) || bags <= 0) return { success: false, message: 'Invalid bags quantity' };
    if (isNaN(rent) || rent < 0) return { success: false, message: 'Invalid rent amount' };
    
    // 1. Get Transaction
    const { data: transaction, error: txError } = await supabase
        .from('withdrawal_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();
    
    if (txError || !transaction) return { success: false, message: 'Transaction not found' };
    
    const storageRecordId = transaction.storage_record_id;
    if (!storageRecordId) return { success: false, message: 'Transaction has no record ID' };

    const record = await getStorageRecord(storageRecordId);
    if (!record) return { success: false, message: 'Storage record not found' };

    // 2. Compute the new record state (calculateUpdateImpact validates stock and
    //    handles the open<->closed transition), then any auto-settle change the
    //    closure flip implies, then apply EVERYTHING in one atomic RPC.
    try {
        const { updates } = BillingService.calculateUpdateImpact(
            record,
            { bags: transaction.bags_withdrawn, rent: transaction.rent_collected || 0 },
            { bags: bags, rent: rent, date: new Date(date) }
        );

        const wasClosed = record.storageEndDate != null;
        const nowClosed = updates.bagsStored === 0;
        const reopening = wasClosed && !nowClosed;
        const closing = !wasClosed && nowClosed;
        const isBulk = !!transaction.batch_id;

        // Keep the withdrawal's existing auto-settle charges unless the edit flips
        // the record's closure state.
        let newHamaliCharged = Number(transaction.hamali_charged || 0);
        let newInsuranceCharged = Number(transaction.insurance_charged || 0);
        let reverseAutosettle = false;
        const addPayments: { amount: number; type: 'hamali' | 'insurance'; notes: string }[] = [];

        if (isBulk && reopening) {
            // No longer closed → its auto-settled hamali/insurance must be reversed.
            reverseAutosettle = true;
            newHamaliCharged = 0;
            newInsuranceCharged = 0;
        } else if (isBulk && closing) {
            // Now closes → auto-settle outstanding hamali/insurance (mirrors bulk outflow).
            const prefix = String(transaction.batch_id).slice(0, 8);
            const hamaliPaid = (record.payments || []).filter(p => p.type === 'hamali').reduce((s, p) => s + p.amount, 0);
            const hamaliDue = Math.max(0, (record.hamaliPayable || 0) - hamaliPaid);
            if (hamaliDue > 0) {
                newHamaliCharged = hamaliDue;
                addPayments.push({ amount: hamaliDue, type: 'hamali', notes: `Hamali auto-settled on record closure (Batch: ${prefix})` });
            }
            const insurancePaid = (record.payments || []).filter(p => p.type === 'insurance').reduce((s, p) => s + p.amount, 0);
            const insuranceDue = Math.max(0, ((record as any).insurancePayable || 0) - insurancePaid);
            if (insuranceDue > 0) {
                newInsuranceCharged = insuranceDue;
                addPayments.push({ amount: insuranceDue, type: 'insurance', notes: `Insurance auto-settled on record closure (Batch: ${prefix})` });
            }
        }

        const finalStorageEndDate = nowClosed ? new Date(date).toISOString() : null;

        const { data: rpcResult, error: rpcError } = await supabase.rpc('update_outflow_atomic', {
            p_transaction_id: transactionId,
            p_new_bags: bags,
            p_new_rent: rent,
            p_new_date: date,
            p_new_bags_stored: updates.bagsStored ?? record.bagsStored,
            p_new_bags_out: updates.bagsOut ?? 0,
            p_new_total_rent_billed: updates.totalRentBilled ?? 0,
            p_new_storage_end_date: finalStorageEndDate,
            p_reset_billing_cycle: reopening,
            p_reverse_autosettle: reverseAutosettle,
            p_new_hamali_charged: newHamaliCharged,
            p_new_insurance_charged: newInsuranceCharged,
            p_add_payments: addPayments,
        });

        if (rpcError || !rpcResult?.success) {
            logError(rpcError || new Error(rpcResult?.error || 'update failed'), { operation: 'updateOutflow', metadata: { transactionId } });
            return { success: false, message: `Failed to update outflow: ${rpcError?.message || rpcResult?.error || 'unknown error'}` };
        }

        revalidatePath('/outflow');
        revalidatePath('/storage');
        revalidatePath('/financials');
        revalidatePath('/reports');
        revalidatePath('/customers');
        if (record.customerId) revalidatePath(`/customers/${record.customerId}`);

        return { success: true, message: 'Outflow updated successfully' };

    } catch (e: any) {
         logError(e, {
             operation: 'updateOutflow',
             metadata: { transactionId }
         });
         return { success: false, message: e.message };
    }
}
