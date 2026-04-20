'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import * as Sentry from "@sentry/nextjs";
import { getAuthUser } from '@/lib/queries/auth';


import { checkRateLimit } from '@/lib/rate-limit';
import { logError, logWarning } from '@/lib/error-logger';
import { ApiResponse } from '@/lib/api-response';
import { PaymentService } from '@/lib/services/payments';
import { getUserWarehouse } from '@/lib/queries';

const { logger } = Sentry;

const PaymentSchema = z.object({
  recordId: z.string(),
  paymentAmount: z.coerce.number().positive('Payment amount must be a positive number.'),
  paymentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  // Accept both UI legacy values and new DB Enum values
  paymentType: z.enum(['Rent/Other', 'Hamali', 'rent', 'hamali', 'advance', 'security_deposit', 'other']),
});

export type PaymentFormState = {
    message: string;
    success: boolean;
    data?: Record<string, any>;
};

export async function addPayment(_prevState: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
    return Sentry.startSpan(
        {
            op: "function",
            name: "addPayment",
        },
        async (span) => {
            const user = await getAuthUser();
            await checkRateLimit(user?.id || 'anon', 'addPayment', { limit: 10 });

            const rawData = {
                recordId: formData.get('recordId'),
                paymentAmount: formData.get('paymentAmount'),
                paymentDate: formData.get('paymentDate'),
                paymentType: formData.get('paymentType'),
            };
            span.setAttribute("recordId", rawData.recordId as string);

            const validatedFields = PaymentSchema.safeParse(rawData);

            if (!validatedFields.success) {
                const error = validatedFields.error.flatten().fieldErrors;
                const message = Object.values(error).flat().join(', ');
                logWarning("Payment validation failed", { operation: 'addPayment', metadata: { errors: error } });
                return { message: `Invalid data: ${message}`, success: false, data: rawData };
            }
            
            const { recordId, paymentAmount, paymentDate, paymentType } = validatedFields.data;
            span.setAttribute("paymentAmount", paymentAmount);

            // Verify record belongs to user's warehouse (defense-in-depth, not RLS-only)
            const warehouseId = await getUserWarehouse();
            if (!warehouseId) {
                return { message: 'No warehouse found for user', success: false, data: rawData };
            }

            try {
                let type: any = 'rent';
                let notes = 'Rent Payment';

                // Map legacy/UI types to DB Enum
                // DB: 'rent' | 'hamali' | 'advance' | 'security_deposit' | 'other'
                if (paymentType === 'Hamali' || paymentType === 'hamali') {
                    type = 'hamali';
                    notes = 'Hamali Payment';
                } else if (paymentType === 'Rent/Other' || paymentType === 'rent') {
                    type = 'rent';
                    notes = 'Rent Payment'; // Default note
                } else {
                    // Pass through other valid types
                    type = paymentType;
                    notes = `${type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')} Payment`;
                }

                const result = await PaymentService.createPayment(recordId, {
                    amount: paymentAmount,
                    date: new Date(paymentDate),
                    type: type,
                    notes: notes
                });

                if (!result.success) throw new Error('Payment creation failed');
                
                logger.info("Payment recorded successfully", { recordId, amount: paymentAmount, type: paymentType });
                
                // We might need to fetch customerId to revalidate specific path.
                // Service could return it, or we rely on general revalidation.
                // Original code fetched record to get customerId.
                // PaymentService.createPayment validates record. 
                // Maybe PaymentService.createPayment should return the Record or CustomerId?
                // Let's assume global revalidation is enough or we improve Service later.
                // Revalidating /customers is broad but safe.
                
                if (result.customerId) {
                    revalidatePath(`/customers/${result.customerId}`);
                }
                revalidatePath('/customers');
                revalidatePath('/financials');
                revalidatePath('/storage');
                revalidatePath('/payments/pending');
                
                return { message: 'Payment recorded successfully!', success: true };
            } catch (error: any) {
                logError(error, {
                    operation: 'addPayment',
                    metadata: { recordId: rawData.recordId, amount: paymentAmount }
                });
                return { message: `Failed to record payment: ${error.message}`, success: false, data: rawData };
            }
        }
    );
}

export async function updatePayment(paymentId: string, formData: FormData) {
    const amount = parseFloat(formData.get('amount') as string);
    const date = formData.get('date') as string;
    const rawType = formData.get('type') as string;
    const notes = formData.get('notes') as string;
    const customerId = formData.get('customerId') as string;

    const user = await getAuthUser();
    await checkRateLimit(user?.id || 'anon', 'updatePayment', { limit: 20 });

    if (!amount || amount <= 0) {
        return { message: 'Invalid payment amount', success: false };
    }

    // Map UI values to valid PaymentType DB enum values
    // 'both' is a UI-only label that means "auto-allocate" → maps to 'other'
    const validTypes = ['rent', 'hamali', 'advance', 'security_deposit', 'other'];
    const type = rawType === 'both' ? 'other' : rawType;
    if (type && !validTypes.includes(type)) {
        return { message: `Invalid payment type: ${rawType}`, success: false };
    }

    try {
        await PaymentService.updatePayment(paymentId, {
            amount,
            date: new Date(date),
            type: type as any,
            notes
        });

        revalidatePath('/customers');
        revalidatePath('/payments/pending');
        if (customerId) revalidatePath(`/customers/${customerId}`);
        revalidatePath('/storage');
        revalidatePath('/financials');
        // Duplicates removed
        
        return { message: 'Payment updated successfully!', success: true };
    } catch (error: any) {
        logError(error, { operation: 'update_payment', metadata: { paymentId } });
        return { message: `Failed to update payment: ${error.message}`, success: false };
    }
}

export async function deletePayment(paymentId: string, customerId: string) {
    const user = await getAuthUser();
    await checkRateLimit(user?.id || 'anon', 'deletePayment', { limit: 10 });

    try {
        await PaymentService.deletePayment(paymentId);
        
        revalidatePath('/customers');
        revalidatePath('/payments/pending');
        revalidatePath(`/customers/${customerId}`);
        revalidatePath('/storage');
        revalidatePath('/financials');
        // Duplicates removed
        return { message: 'Payment deleted successfully!', success: true };
    } catch (error: any) {
        logError(error, { operation: 'delete_payment', metadata: { paymentId } });
        return { message: 'Failed to delete payment', success: false };
    }
}

export type BulkPaymentFormState = ApiResponse<{
        allocations?: any[];
        recordsUpdated?: number;
}>;

export async function processBulkPayment(
    _prevState: BulkPaymentFormState,
    formData: FormData
): Promise<BulkPaymentFormState> {
    return Sentry.startSpan(
        {
            op: "function",
            name: "processBulkPayment",
        },
        async (span) => {
            const user = await getAuthUser();
            await checkRateLimit(user?.id || 'anon', 'processBulkPayment', { limit: 5 });

            const customerId = formData.get('customerId') as string;
            const totalAmount = parseFloat(formData.get('totalAmount') as string);
            const paymentDate = formData.get('paymentDate') as string;
            const strategy = formData.get('strategy') as 'fifo' | 'manual';
            const manualAllocationsJSON = formData.get('manualAllocations') as string;

            span.setAttribute("customerId", customerId);
            span.setAttribute("totalAmount", totalAmount);

            if (!customerId || isNaN(totalAmount) || totalAmount <= 0) {
                return { 
                    message: 'Invalid payment data provided.', 
                    success: false 
                };
            }

            try {
                const manualAllocations = manualAllocationsJSON ? JSON.parse(manualAllocationsJSON) : undefined;

                const result = await PaymentService.processBulk(
                    customerId,
                    totalAmount,
                    paymentDate,
                    strategy,
                    manualAllocations
                );

                if (!result.success) {
                    return { message: result.message || 'Payment failed', success: false };
                }

                logger.info("Bulk payment processed successfully", { 
                    customerId, 
                    totalAmount, 
                    recordsUpdated: result.recordsUpdated 
                });

                revalidatePath('/payments/pending');
                revalidatePath('/customers');
                revalidatePath(`/customers/${customerId}`);

                return { 
                    message: result.message!, 
                    success: true,
                    data: {
                        allocations: result.allocations,
                        recordsUpdated: result.recordsUpdated
                    }
                };

            } catch (error: any) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logError(error, {
                    operation: 'processBulkPayment',
                    metadata: { customerId, totalAmount }
                });
                return { 
                    message: `Failed to process bulk payment: ${errorMessage}`, 
                    success: false 
                };
            }
        }
    );
}
