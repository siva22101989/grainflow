'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getUserWarehouse } from './queries';
import { logError } from '@/lib/error-logger';
import { UserRole } from '@/types/db';



async function checkAdminPermissions() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { authorized: false };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, warehouse_id')
        .eq('id', user.id)
        .single();

    const isAuthorized = profile?.role === UserRole.SUPER_ADMIN || profile?.role === UserRole.OWNER;
    return { 
        authorized: isAuthorized, 
        role: profile?.role, 
        warehouseId: profile?.warehouse_id,
        userId: user.id
    };
}

export async function updateUserRole(userId: string, newRole: string) {
    const { authorized, role, warehouseId } = await checkAdminPermissions();
    if (!authorized) {
        return { success: false, message: 'Unauthorized' };
    }

    const supabase = await createClient();

    // If owner, check if the target user is in their warehouse
    if (role === UserRole.OWNER) {
        const { data: targetProfile } = await supabase
            .from('profiles')
            .select('warehouse_id')
            .eq('id', userId)
            .single();

        if (targetProfile?.warehouse_id !== warehouseId) {
            return { success: false, message: 'Unauthorized: User belongs to another warehouse' };
        }
    }

    const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

    if (error) {
        logError(error, { operation: 'updateUserRole', metadata: { userId, newRole } });
        return { success: false, message: error.message };
    }

    revalidatePath('/admin');
    return { success: true, message: 'Role updated successfully' };
}

export async function bulkUpdateUserRoles(userIds: string[], newRole: string) {
    const { authorized, role, warehouseId } = await checkAdminPermissions();
    if (!authorized) return { success: false, message: 'Unauthorized' };

    const supabase = await createClient();

    let query = supabase.from('profiles').update({ role: newRole }).in('id', userIds);

    // If owner, restrict to their warehouse
    if (role === UserRole.OWNER) {
        query = query.eq('warehouse_id', warehouseId);
    }

    const { error } = await query;

    if (error) {
        logError(error, { operation: 'bulkUpdateUserRoles', metadata: { count: userIds.length, newRole } });
        return { success: false, message: error.message };
    }

    revalidatePath('/admin');
    return { success: true, message: `Updated ${userIds.length} users successfully` };
}

export async function bulkDeleteUsers(userIds: string[]) {
    const { authorized, role, warehouseId } = await checkAdminPermissions();
    if (!authorized) return { success: false, message: 'Unauthorized' };

    const supabase = await createClient();

    let query = supabase.from('profiles').delete().in('id', userIds);

    // If owner, restrict to their warehouse
    if (role === UserRole.OWNER) {
        query = query.eq('warehouse_id', warehouseId);
    }

    const { error } = await query;

    if (error) {
        logError(error, { operation: 'bulkDeleteUsers', metadata: { count: userIds.length } });
        return { success: false, message: error.message };
    }

    revalidatePath('/admin');
    return { success: true, message: `Deleted ${userIds.length} users successfully` };
}

export async function deleteWarehouseAction(warehouseId: string) {
    const { authorized, role } = await checkAdminPermissions();
    if (!authorized || role !== UserRole.SUPER_ADMIN) {
        return { success: false, message: 'Unauthorized: Only super admins can delete warehouses' };
    }

    const adminSupabase = createAdminClient(); // Use admin client for core deletion logic
    // const supabase = await createClient(); // Keep standard client for revalidatePath etc. if needed
    
    try {
        // 1. Broad cleanup across all tables using warehouse_id
        // This handles tables that are NOT partitioned and have a direct warehouse_id
        const tablesByWarehouseId = [
            'stock_movements',
            'warehouse_lots',
            'sms_settings',
            'sequences',
            'user_commodity_watchlist',
            'unloading_records',
            'expenses',
            'customers',
            'crops',
            'warehouse_invitations',
            'activity_logs',
            'notifications',
            'warehouse_assignments',
            'user_warehouses',
            'warehouse_settings'
        ];

        for (const table of tablesByWarehouseId) {
            await adminSupabase.from(table).delete().eq('warehouse_id', warehouseId);
        }

        // 2. Surgical cleanup for storage-linked data
        // Fetch storage records to get their IDs for cascading manual deletes
        const { data: records, error: fetchRecordsError } = await adminSupabase
            .from('storage_records')
            .select('id')
            .eq('warehouse_id', warehouseId);
        
        if (fetchRecordsError) throw fetchRecordsError;

        if (records && records.length > 0) {
            const recordIds = records.map(r => r.id);
            
            // Delete payments and withdrawals tied to these storage records
            await adminSupabase.from('payments').delete().in('storage_record_id', recordIds);
            await adminSupabase.from('withdrawal_transactions').delete().in('storage_record_id', recordIds);
            
            // Final check: Some stock_movements might still exist if delete by warehouse_id failed (partitions)
            await adminSupabase.from('stock_movements').delete().in('storage_record_id', recordIds);
            
            // Now safe to delete storage records
            const { error: srErr } = await adminSupabase.from('storage_records').delete().in('id', recordIds);
            if (srErr) throw srErr;
        }

        // 3. Subscription cleanup
        const { data: sub } = await adminSupabase.from('subscriptions').select('id').eq('warehouse_id', warehouseId).single();
        if (sub) {
            await adminSupabase.from('subscription_payments').delete().eq('subscription_id', sub.id);
            await adminSupabase.from('subscriptions').delete().eq('id', sub.id);
        }

        // 4. Profiles: Unlink users
        await adminSupabase.from('profiles').update({ warehouse_id: null }).eq('warehouse_id', warehouseId);

        // 5. Final Delete: The Warehouse itself
        const { error } = await adminSupabase
            .from('warehouses')
            .delete()
            .eq('id', warehouseId);

        if (error) throw error;

        revalidatePath('/admin');
        return { success: true, message: 'Warehouse and all its data deleted permanently' };
    } catch (error: any) {
        logError(error, { operation: 'deleteWarehouseAction (Hard Delete)', metadata: { warehouseId } });
        return { success: false, message: error.message };
    }
}

export async function updateWarehouseDetails(formData: FormData) {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) throw new Error('Unauthorized');

    const name = formData.get('name') as string;
    const location = formData.get('location') as string;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const capacityStr = formData.get('capacity') as string;
    const capacity = capacityStr ? parseInt(capacityStr) : undefined;
    const gstNumber = formData.get('gstNumber') as string;

    const updates: any = { name, location, phone, email, gst_number: gstNumber };
    if (capacity !== undefined && !isNaN(capacity)) {
        updates.capacity_bags = capacity;
    }

    const { error } = await supabase
        .from('warehouses')
        .update(updates)
        .eq('id', warehouseId);

    if (error) {
        logError(error, { operation: 'updateWarehouseDetails', metadata: { warehouseId } });
        throw new Error(error.message);
    }

    revalidatePath('/settings');
}

export async function assignWarehousePlan(warehouseId: string, planTier: string) {
    const { authorized, role } = await checkAdminPermissions();
    if (!authorized || role !== UserRole.SUPER_ADMIN) {
        return { success: false, message: 'Unauthorized: Only super admins can assign plans' };
    }

    const supabase = await createClient();

    // 1. Get the plan details by tier (including duration_days)
    const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('id, duration_days')
        .eq('tier', planTier)
        .single();

    if (planError || !plan) {
        return { success: false, message: 'Invalid plan tier' };
    }

    // 2. Calculate expiry date based on plan duration
    // Free plan (duration_days = 0 or null) has no expiry
    // Paid plans use their duration_days (e.g., 30 for monthly, 365 for yearly)
    const currentPeriodEnd = !plan.duration_days || plan.duration_days === 0
        ? null 
        : new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();

    // 3. Upsert the subscription
    const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
            warehouse_id: warehouseId,
            plan_id: plan.id,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: currentPeriodEnd,
            grace_period_end: null,           // Clear grace period
            grace_period_notified: false,     // Reset notification
            updated_at: new Date().toISOString()
        }, { onConflict: 'warehouse_id' });

    if (subError) {
        logError(subError, { operation: 'assignWarehousePlan', metadata: { warehouseId, planTier } });
        return { success: false, message: subError.message };
    }

    revalidatePath('/admin');
    return { success: true, message: `Plan upgraded to ${planTier.toUpperCase()} successfully` };
}


export async function addCrop(formData: FormData) {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    
    if (!warehouseId) throw new Error('Warehouse not found');

    const name = formData.get('name') as string;
    const rentPrice6m = parseFloat(formData.get('price6m') as string);
    const rentPrice1y = parseFloat(formData.get('price1y') as string);
    const insurancePerBagRaw = formData.get('insurancePerBag') as string | null;
    const insurancePerBag = insurancePerBagRaw ? parseFloat(insurancePerBagRaw) : 0;

    if (!name || isNaN(rentPrice6m) || isNaN(rentPrice1y)) {
        throw new Error('Invalid crop data');
    }
    if (isNaN(insurancePerBag) || insurancePerBag < 0) {
        throw new Error('Insurance per bag must be a non-negative number');
    }

    const { error } = await supabase.from('crops').insert({
        warehouse_id: warehouseId,
        name,
        rent_price_6m: rentPrice6m,
        rent_price_1y: rentPrice1y,
        insurance_per_bag: insurancePerBag
    });

    if (error) {
        logError(error, { operation: 'addCrop', metadata: { warehouseId, name } });
        throw new Error('Failed to add crop');
    }

    revalidatePath('/settings');
    revalidatePath('/settings/lots');
}

