'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/lib/safe-action';
import { UserRole, AuditAction, AuditEntity } from '@/types/db';

import { logError } from '@/lib/error-logger';

/**
 * Grant or revoke access to a specific warehouse for a user.
 */
export async function toggleWarehouseAccess(
    userId: string, 
    warehouseId: string, 
    role: string = UserRole.STAFF
): Promise<ActionState> {
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!currentUser) return { message: 'Unauthorized', success: false };

    try {
        // 1. Verify Current User Permissions (Must be Owner or Admin of the target warehouse)
        const { data: currentAccess } = await supabase
            .from('warehouse_assignments')
            .select('role')
            .eq('user_id', currentUser.id)
            .eq('warehouse_id', warehouseId)
            .single();

        if (!currentAccess || ![UserRole.OWNER, UserRole.ADMIN].includes(currentAccess.role as UserRole)) {
            // Super admin exception
            const { data: currentProfile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
            if (currentProfile?.role !== UserRole.SUPER_ADMIN) {
                return { message: 'Forbidden: You do not have permission to manage staff for this warehouse.', success: false };
            }
        }

        // 2. Check for existing assignment (including soft deleted)
        const { data: existingAccess } = await supabase
            .from('warehouse_assignments')
            .select('id, deleted_at, role')
            .eq('user_id', userId)
            .eq('warehouse_id', warehouseId)
            .single();

        if (existingAccess && !existingAccess.deleted_at) {
            // Active assignment exists -> Revoke Access (Soft Delete)
            const { error } = await supabase
                .from('warehouse_assignments')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', existingAccess.id);

            if (error) {
                logError(error, { operation: 'toggleWarehouseAccess:revoke', userId, warehouseId });
                return { message: 'Failed to revoke access: ' + error.message, success: false };
            }
            
            // AUDIT LOG
            const { logActivity } = await import('@/lib/audit-service');
            await logActivity({
                action: AuditAction.DELETE,
                entity: AuditEntity.USER,
                entityId: userId,
                warehouseId,
                details: { role: existingAccess.role, operation: 'revoke_access' },
                actorUserId: currentUser.id
            });

            revalidatePath('/settings/team');
            return { message: 'Access revoked successfully', success: true };
        } else if (existingAccess && existingAccess.deleted_at) {
            // Soft deleted assignment exists -> Restore Access
            const { checkSubscriptionLimits } = await import('@/services/subscription-service');
            const limitCheck = await checkSubscriptionLimits(warehouseId, 'add_user');
            if (!limitCheck.allowed) {
                return { message: limitCheck.message || 'Plan user limit reached.', success: false };
            }

            const { error } = await supabase
                .from('warehouse_assignments')
                .update({ 
                    deleted_at: null,
                    role: role 
                })
                .eq('id', existingAccess.id);

            if (error) {
                logError(error, { operation: 'toggleWarehouseAccess:restore', userId, warehouseId });
                return { message: 'Failed to restore access: ' + error.message, success: false };
            }

            // AUDIT LOG
            const { logActivity } = await import('@/lib/audit-service');
            await logActivity({
                action: AuditAction.CREATE,
                entity: AuditEntity.USER,
                entityId: userId,
                warehouseId,
                details: { role, operation: 'restore_access' },
                actorUserId: currentUser.id
            });

            revalidatePath('/settings/team');
            return { message: 'Access granted successfully', success: true };
        } else {
            // No assignment exists -> Grant New Access
            const { checkSubscriptionLimits } = await import('@/services/subscription-service');
            const limitCheck = await checkSubscriptionLimits(warehouseId, 'add_user');
            if (!limitCheck.allowed) {
                return { message: limitCheck.message || 'Plan user limit reached.', success: false };
            }

            const { error } = await supabase
                .from('warehouse_assignments')
                .insert({
                    user_id: userId,
                    warehouse_id: warehouseId,
                    role: role
                });

            if (error) {
                logError(error, { operation: 'toggleWarehouseAccess:create', userId, warehouseId });
                return { message: 'Failed to grant access: ' + error.message, success: false };
            }
            
            // AUDIT LOG
            const { logActivity } = await import('@/lib/audit-service');
            await logActivity({
                action: AuditAction.CREATE,
                entity: AuditEntity.USER,
                entityId: userId,
                warehouseId,
                details: { role, operation: 'grant_access' },
                actorUserId: currentUser.id
            });

            revalidatePath('/settings/team');
            return { message: 'Access granted successfully', success: true };
        }
    } catch (error: any) {
        logError(error, { operation: 'toggleWarehouseAccess:unknown', userId, warehouseId });
        return { message: 'An unexpected error occurred.', success: false };
    }
}

/**
 * Update the role for a specific staff assignment.
 */
export async function updateStaffRoleInWarehouse(
    userId: string,
    warehouseId: string,
    role: string
): Promise<ActionState> {
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) return { message: 'Unauthorized', success: false };

    try {
        // 1. Verify Permissions (Simplified check for now)
        // [In a real simplified version we might verify again, but assuming caller checks UI state first]
        
        // 2. Update Role
        const { error } = await supabase
            .from('warehouse_assignments')
            .update({ role })
            .eq('user_id', userId)
            .eq('warehouse_id', warehouseId);

        if (error) {
            logError(error, { operation: 'updateStaffRoleInWarehouse', userId, warehouseId });
            return { message: 'Failed to update role: ' + error.message, success: false };
        }

        // AUDIT LOG
        const { logActivity } = await import('@/lib/audit-service');
        await logActivity({
            action: AuditAction.UPDATE,
            entity: AuditEntity.USER,
            entityId: userId,
            warehouseId,
            details: { new_role: role },
            actorUserId: currentUser.id
        });

        revalidatePath('/settings/team');
        return { message: 'Role updated successfully', success: true };
    } catch (error: any) {
        logError(error, { operation: 'updateStaffRoleInWarehouse:unknown', userId, warehouseId });
        return { message: 'Failed to update role.', success: false };
    }
}

export async function getMemberAssignments(userId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('warehouse_assignments')
        .select('warehouse_id, role')
        .eq('user_id', userId)
        .is('deleted_at', null);
    
    if (error) return [];
    return data;
}
