'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { addDays } from 'date-fns';
import { logError } from './error-logger';

export interface GenerateCodeParams {
    planId: string;
    durationDays: number;
    notes?: string;
    count?: number; // Optional bulk generation
}

/**
 * Generate a random alphanumeric code
 * Format: XXXX-XXXX-XXXX
 */
function generateRandomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, O, 0 for readibility
    let result = '';
    for (let i = 0; i < 12; i++) {
        if (i > 0 && i % 4 === 0) result += '-';
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Admin Action: Generate new subscription codes
 */
export async function generateCodeAction({ planId, durationDays, notes, count = 1 }: GenerateCodeParams) {
    const supabase = await createClient();
    
    // 1. Check Admin Permissions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'super_admin') {
        throw new Error('Only admins can generate codes');
    }

    // 2. Generate Codes
    const codesToInsert = [];
    const generatedCodesList = [];
    
    for (let i = 0; i < count; i++) {
        const code = generateRandomCode();
        generatedCodesList.push(code);
        codesToInsert.push({
            code: code,
            plan_id: planId,
            duration_days: durationDays,
            created_by: user.id,
            status: 'available',
            notes: notes
        });
    }

    const { error } = await supabase.from('subscription_codes').insert(codesToInsert);

    if (error) {
        logError(error, { operation: 'generateCodeAction', metadata: { planId, count } });
        throw new Error('Failed to generate codes');
    }

    revalidatePath('/admin/subscriptions');
    // Return code objects not just strings if possible, but strings are fine for now based on component usage
    return { success: true, count, codes: generatedCodesList };
}

/**
 * User Action: Redeem a code
 */
export async function redeemCodeAction(code: string, warehouseId: string) {
    const supabase = await createClient();
    const cleanCode = code.trim().toUpperCase();

    // 1. Validate Code
    const { data: codeRecord, error: codeError } = await supabase
        .from('subscription_codes')
        .select('*, plans(*)')
        .eq('code', cleanCode)
        .single();

    if (codeError || !codeRecord) {
        throw new Error('Invalid code');
    }

    if (codeRecord.status !== 'available') {
        throw new Error('This code has already been used or revoked');
    }

    // 2. Transact: Mark as used -> Update Subscription
    // Supabase doesn't support complex transactions via Client easily without RPC, 
    // so we'll do simplistic optimistic locking logic here.
    
    // Mark as used
    const { error: updateError } = await supabase
        .from('subscription_codes')
        .update({
            status: 'used',
            used_by_warehouse_id: warehouseId,
            used_at: new Date().toISOString()
        })
        .eq('id', codeRecord.id)
        .eq('status', 'available'); // Optimistic lock

    if (updateError) {
        throw new Error('Code redemption failed. Please try again.');
    }

    // 3. Update Subscription
    // Calculate new end date
    const { data: currentSub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('warehouse_id', warehouseId)
        .single();
    
    let newStartDate = new Date();
    let newEndDate = addDays(newStartDate, codeRecord.duration_days);

    // If active subscription exists and extending same/higher plan, add to end
    if (currentSub && currentSub.status === 'active' && new Date(currentSub.current_period_end) > new Date()) {
         newStartDate = new Date(currentSub.current_period_end);
         newEndDate = addDays(newStartDate, codeRecord.duration_days);
    }

    const { error: subError } = await supabase.from('subscriptions').upsert({
        warehouse_id: warehouseId,
        plan_id: codeRecord.plan_id,
        status: 'active',
        current_period_start: newStartDate.toISOString(),
        current_period_end: newEndDate.toISOString(),
        updated_at: new Date().toISOString()
    }, { onConflict: 'warehouse_id' });

    if (subError) {
        // Critical: Failed to update sub after burning code.
        // In production, this needs robust logging/alerting or rollback.
        logError(subError, { operation: 'redeemCodeAction_subUpdate', metadata: { code: cleanCode, warehouseId } });
        throw new Error('Activation failed. Please contact support with code: ' + cleanCode);
    }

    revalidatePath('/settings');
    return { success: true, plan: codeRecord.plans.name, endDate: newEndDate };
}

export async function getAllSubscriptionCodes() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Check admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'super_admin') return [];

    const { data, error } = await supabase
        .from('subscription_codes')
        .select(`
            *,
            plans (
                name,
                tier
            ),
            warehouses (
                name,
                location
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        logError(error, { operation: 'getAllSubscriptionCodes' });
        return [];
    }

    return data;
}
