'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { getUserWarehouse } from './data';
import { WarehouseWithRole } from './definitions';
import { checkRateLimit } from '@/lib/rate-limit';
import * as Sentry from "@sentry/nextjs";
import { logError, logWarning } from './error-logger';
import { authenticatedAction, type ActionState } from '@/lib/safe-action';
import { checkWarehouseCreationLimit, checkSubscriptionLimits } from '@/services/subscription-service';
import { UserRole, AuditAction, AuditEntity } from '@/types/db';

// --- Warehouse Management ---

export async function createWarehouse(name: string, location: string, capacity: number, email?: string, phone?: string, gstNumber?: string): Promise<ActionState> {
    return authenticatedAction('createWarehouse', async (_user, supabase, _userRole) => {
        try {
            await checkRateLimit(_user.id, 'createWarehouse', { limit: 3, windowMs: 3600000 }); // 3 per hour
        } catch (e: any) {
             return { message: e.message, success: false };
        }

        Sentry.setTag("warehouseName", name);

        // 1. Plan Verification
        const limitCheck = await checkWarehouseCreationLimit(_user.id);
        if (!limitCheck.allowed) {
            return { message: limitCheck.message || 'Plan limit reached', success: false };
        }

        // 2. Create Warehouse via Secure RPC (updated for GST)
        const { data: warehouseId, error } = await supabase.rpc('create_new_warehouse', {
            p_name: name,
            p_location: location,
            p_capacity: capacity,
            p_email: email,
            p_phone: phone
        });

        if (error) {
            throw error; // Let safe-action handle logging
        }
        
        // Update GST Number immediately if provided
        if (gstNumber) {
             await supabase.from('warehouses').update({ gst_number: gstNumber }).eq('id', warehouseId);
        }

        // 2. Switch Context
        await switchWarehouse(warehouseId);

        // 3. Activate Trial (if new user)
        const selectedPlan = _user.user_metadata?.selected_plan;
        if (selectedPlan) {
             try {
                 const { createTrialSubscription } = await import('@/lib/auth-actions');
                 await createTrialSubscription(_user.id, selectedPlan, warehouseId);
             } catch (e) {
                 logError(e, { operation: 'createWarehouse_trialActivation', metadata: { warehouseId, plan: selectedPlan } });
             }
        }

        // AUDIT LOG
        try {
            const { logActivity } = await import('@/lib/audit-service');
            await logActivity({
                action: AuditAction.CREATE,
                entity: AuditEntity.SETTINGS, // Warehouse is a setting/config entity
                entityId: warehouseId,
                warehouseId: warehouseId,
                details: { name, location, capacity },
                actorUserId: _user.id
            });
        } catch (auditError) {
             // Non-blocking
        }

        revalidatePath('/', 'layout');
        return { message: 'Warehouse created!', success: true, data: { id: warehouseId } };
    });
}

export async function switchWarehouse(warehouseId: string): Promise<ActionState> {
    return authenticatedAction('switchWarehouse', async (user, supabase, userRole) => {
        // userRole already provided by authenticatedAction from profiles.role
        const isSuperAdmin = userRole === UserRole.SUPER_ADMIN;

        if (!isSuperAdmin) {
            // Verify Access for normal users (just check assignment exists)
            const { data: access } = await supabase
                .from('warehouse_assignments')
                .select('warehouse_id')
                .eq('user_id', user.id)
                .eq('warehouse_id', warehouseId)
                .is('deleted_at', null)
                .single();

            if (!access) return { message: 'Access Denied', success: false };
        }

        // Update Profile warehouse_id (role stays the same - from profiles.role)
        const { error } = await supabase
            .from('profiles')
            .update({ warehouse_id: warehouseId })
            .eq('id', user.id);

        if (error) throw error;

        revalidatePath('/', 'layout');
        return { message: 'Switched successfully', success: true };
    });
}

export async function getUserWarehouses(): Promise<WarehouseWithRole[]> {
    // This is a Read Action, but authenticatedAction returns ActionState { success, message, data }.
    // getUserWarehouses returns specific array.
    // We should keep specific return type for this query function or wrap it.
    // Let's implement manually to preserve signature.
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Check if Super Admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    
    if (profile?.role === UserRole.SUPER_ADMIN) {
        const { data, error } = await supabase.rpc('get_admin_warehouses');
        if (error) {
            logError(error, { operation: 'getUserWarehouses_superAdmin' });
            return [];
        }
        return data.map((w: any) => ({
            id: w.id,
            role: UserRole.SUPER_ADMIN,
            name: w.name,
            location: w.location || '',
            gst_number: w.gst_number || ''
        }));
    }

    // Normal User
    const { data, error } = await supabase
        .from('warehouse_assignments')
        .select(`
            warehouse_id,
            warehouses (
                id,
                name,
                location,
                gst_number
            )
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null);
    
    if (error) {
        logError(error, { operation: 'getUserWarehouses', metadata: { userId: user.id } });
        return [];
    }


    // Type assertion or mapping - use profile.role for all warehouses
    return (data as any[]).map((d: any) => ({
        id: d.warehouse_id,
        role: profile?.role || UserRole.STAFF, // Use profile role as single source of truth
        name: d.warehouses?.name || 'Unknown',
        location: d.warehouses?.location || '',
        gst_number: d.warehouses?.gst_number || ''
    }));
}

export async function getActiveWarehouseId() {
   return getUserWarehouse();
}

// --- Invitations (Magic Links) ---

export async function generateInviteLink(role: UserRole = UserRole.STAFF): Promise<ActionState> {
    return authenticatedAction('generateInviteLink', async (_user, supabase, userRole) => {
        // Only owners, admins, and super_admin can invite team members.
        // Staff/manager calling this directly would be a privilege escalation risk.
        const allowed = [UserRole.OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(userRole as UserRole);
        if (!allowed) {
            return { message: 'Only owners and admins can generate invite links.', success: false };
        }

        // Prevent anyone from escalating: no one except super_admin can mint OWNER invites.
        // super_admin is platform-level and shouldn't be invited via a tenant link at all.
        const invalidRoles: UserRole[] = [UserRole.SUPER_ADMIN];
        if (userRole !== UserRole.SUPER_ADMIN) {
            invalidRoles.push(UserRole.OWNER);
        }
        if (invalidRoles.includes(role)) {
            return { message: `You cannot generate an invite link for role '${role}'.`, success: false };
        }

        const warehouseId = await getUserWarehouse();
        if (!warehouseId) return { message: 'No active warehouse', success: false };

        const limitCheck = await checkSubscriptionLimits(warehouseId, 'add_user');
        if (!limitCheck.allowed) {
            return { message: limitCheck.message || 'Plan user limit reached.', success: false };
        }

        const { data, error } = await supabase
            .from('warehouse_invitations')
            .insert({
                warehouse_id: warehouseId,
                role,
            })
            .select('token')
            .single();

        if (error) throw error;

        return { message: 'Link generated', success: true, data: { token: data.token } };
    });
}

export async function joinWarehouse(token: string): Promise<ActionState> {
    return authenticatedAction('joinWarehouse', async (user, supabase, _userRole) => {
        Sentry.setTag("token", token);

        const { data, error } = await supabase.rpc('claim_warehouse_invite', {
            p_token: token,
            p_user_id: user.id
        });

        if (error) throw error;

        await switchWarehouse(data); 

        revalidatePath('/', 'layout');
        return { message: 'Joined successfully!', success: true };
    });
}

export async function leaveWarehouse(warehouseId: string): Promise<ActionState> {
     return authenticatedAction('leaveWarehouse', async (user, supabase, _userRole) => {
        const { error } = await supabase
            .from('warehouse_assignments')
            .update({ deleted_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('warehouse_id', warehouseId);

        if (error) throw error;
        
        await supabase.from('profiles').update({ warehouse_id: null }).eq('id', user.id);

        revalidatePath('/', 'layout');
        return { message: 'Left warehouse', success: true };
     });
}

// Request Access Flow
export async function requestJoinWarehouse(adminEmail: string): Promise<ActionState> {
    return authenticatedAction('requestJoinWarehouse', async (user, supabase, _userRole) => {
        Sentry.setTag("adminEmail", adminEmail);

        const { data: adminProfile } = await supabase
            .from('profiles')
            .select('id, warehouse_id')
            .eq('email', adminEmail)
            .in('role', [UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN])
            .single();
        
        if (!adminProfile || !adminProfile.warehouse_id) {
            logWarning("Admin not found for join request", { operation: 'requestJoinWarehouse', metadata: { adminEmail } });
            return { message: 'Admin not found or has no warehouse.', success: false };
        }

        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: adminProfile.id,
                warehouse_id: adminProfile.warehouse_id,
                type: 'join_request',
                title: 'Staff Join Request',
                message: `User ${user.user_metadata?.full_name || 'Staff'} (${user.email}) requested to join.`,
                link: `/settings/team?approve_user=${user.id}&name=${encodeURIComponent(user.user_metadata?.full_name || '')}`,
                is_read: false
            });

        if (error) throw error;

        return { message: 'Request sent successfully', success: true };
    });
}

export async function approveJoinRequest(notificationId: string, requesterId: string): Promise<ActionState> {
    return authenticatedAction('approveJoinRequest', async (user, supabase, _userRole) => {
        const { data: notification } = await supabase
            .from('notifications')
            .select('*')
            .eq('id', notificationId)
            .eq('user_id', user.id)
            .single();
        
        if (!notification) return { message: 'Request not found or unauthorized', success: false };

        const warehouseId = notification.warehouse_id;
        
        const { error: assignError } = await supabase
            .from('warehouse_assignments')
            .insert({
                user_id: requesterId,
                warehouse_id: warehouseId,
                role: UserRole.STAFF
            });

        if (assignError) throw assignError;

        await supabase.from('profiles').update({ 
            warehouse_id: warehouseId,
            role: UserRole.STAFF
        }).eq('id', requesterId);

        await supabase.from('notifications').delete().eq('id', notificationId);

        revalidatePath('/', 'layout');
        return { message: 'User approved successfully', success: true };
    });
}

export async function rejectJoinRequest(notificationId: string): Promise<ActionState> {
    return authenticatedAction('rejectJoinRequest', async (user, supabase, _userRole) => {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId)
            .eq('user_id', user.id);

        if (error) throw error;

        revalidatePath('/settings/team');
        return { message: 'Request rejected', success: true };
    });
}
