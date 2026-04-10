'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as Sentry from "@sentry/nextjs";

import { createClient } from '@/utils/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { logError } from '@/lib/error-logger';
import { FormState } from './common';
import { roleHierarchy } from '@/lib/definitions';
import { getTeamMembers } from '@/lib/queries';
import { UserRole } from '@/types/db';


export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
    return Sentry.startSpan(
        {
            op: "function",
            name: "changePassword",
        },
        async (_) => {
            const password = formData.get('password') as string;
            const confirmPassword = formData.get('confirmPassword') as string;

            // Simple anonymous rate limit for password changes by IP (effectively)
            await checkRateLimit('anon-pwd', 'changePassword', { limit: 3 });

            if (!password || !confirmPassword) {
                return { message: 'Please fill in all fields', success: false };
            }

            if (password !== confirmPassword) {
                return { message: 'Passwords do not match', success: false };
            }

            if (password.length < 6) {
                return { message: 'Password must be at least 6 characters', success: false };
            }

            const supabase = await createClient();
            const { error } = await supabase.auth.updateUser({ password: password });

            if (error) {
                logError(error, { operation: 'changePassword' });
                return { message: error.message, success: false };
            }

            Sentry.addBreadcrumb({
                category: 'auth',
                message: 'Password updated successfully',
                level: 'info'
            });
            return { message: 'Password updated successfully', success: true };
        }
    );
}

const TeamMemberSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  fullName: z.string().min(2, 'Name is required.'),
  role: z.enum(['admin', 'manager', 'staff']),
});

export async function createTeamMember(_: FormState, formData: FormData): Promise<FormState> {
  const { data: { user: currentUser } } = await (await createClient()).auth.getUser();
  await checkRateLimit(currentUser?.id || 'anon', 'createTeamMember', { limit: 5 });

  const validatedFields = TeamMemberSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
    role: formData.get('role'),
  });

  if (!validatedFields.success) {
    const error = validatedFields.error.flatten().fieldErrors;
    const message = Object.values(error).flat().join(', ');
    return { 
      message: `Invalid inputs: ${message}`, 
      success: false, 
      data: { 
        email: formData.get('email'), 
        fullName: formData.get('fullName'), 
        role: formData.get('role') 
      } 
    };
  }

  const { email, password, fullName, role } = validatedFields.data;
  const warehouseId = formData.get('warehouseId') as string;

  // 1. Check if current user is logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { message: 'Unauthorized', success: false };
  }

  // 2. Use Admin Client to create user
  try {
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const supabaseAdmin = createAdminClient();
    
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: role,
        created_by: user.id
      }
    });

    if (authError) {
      return { message: authError.message, success: false };
    }
    
    // 3. Create Warehouse Assignment
    // If no warehouseId provided, use the creator's current warehouse
    let targetWarehouseId = warehouseId;
    if (!targetWarehouseId) {
        const { data: profile } = await supabase.from('profiles').select('warehouse_id').eq('id', user.id).single();
        targetWarehouseId = profile?.warehouse_id;
    }

    if (targetWarehouseId && newUser.user) {
        // 1. Create Assignment
        await supabaseAdmin.from('warehouse_assignments').insert({
            user_id: newUser.user.id,
            warehouse_id: targetWarehouseId,
            role: role
        });

        // 2. Sync Profile (Legacy Support)
        await supabaseAdmin.from('profiles').update({
            warehouse_id: targetWarehouseId
        }).eq('id', newUser.user.id);
    }

    return { message: `User ${email} created successfully!`, success: true };

  } catch (err: any) {
    logError(err, { operation: 'createTeamMember', metadata: { email, role } });
    return { message: err.message || 'Server Error', success: false };
  }
}

const UserProfileSchema = z.object({
    fullName: z.string().min(2, "Name must be at least 2 characters."),
    phone: z.string().optional(),
});

export async function updateUserProfile(_: FormState, formData: FormData): Promise<FormState> {
    const validatedFields = UserProfileSchema.safeParse({
        fullName: formData.get('fullName'),
        phone: formData.get('phone'),
    });

    if (!validatedFields.success) {
        return { message: "Invalid data", success: false };
    }

    const { fullName, phone } = validatedFields.data;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { message: "Unauthorized", success: false };

    const { error } = await supabase
        .from('profiles')
        .update({ 
            full_name: fullName,
            phone: phone || null
        })
        .eq('id', user.id);

    if (error) {
        return { message: "Failed to update profile", success: false };
    }

    revalidatePath('/settings');
    return { message: "Profile updated successfully", success: true };
}


export async function updateTeamMember(userId: string, formData: FormData) {
    const role = formData.get('role') as string;
    const fullName = formData.get('fullName');
    
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return { message: "Unauthorized", success: false };

    // 1. Get Current User Role
    const { data: currentProfile } = await supabase.from('profiles').select('role, warehouse_id').eq('id', currentUser.id).single();
    if (!currentProfile) return { message: "Profile not found", success: false };

    const currentRank = roleHierarchy[currentProfile.role] || 0;

    // 2. Get Target User Role
    const { data: targetProfile } = await supabase.from('profiles').select('role, warehouse_id').eq('id', userId).single();
    if (!targetProfile) return { message: "Target user not found", success: false };

    const targetRank = roleHierarchy[targetProfile.role] || 0;

    // 3. Check Permissions
    // Must be in same warehouse (unless Super Admin)
    if (currentProfile.role !== UserRole.SUPER_ADMIN && currentProfile.warehouse_id !== targetProfile.warehouse_id) {
        return { message: "Unauthorized: Different warehouse", success: false };
    }

    // Must have higher rank to edit (or be Owner/SuperAdmin editing anyone below)
    if (currentRank <= targetRank) {
        return { message: "Unauthorized: Insufficient privileges to edit this user.", success: false };
    }

    // 4. Check Promoted Role Rank
    if (role) {
        const newRoleRank = roleHierarchy[role] || 0;
        if (newRoleRank >= currentRank) {
             return { message: "Unauthorized: Cannot assign a role equal to or higher than your own.", success: false };
        }
    }

    const updateData: any = {};
    if (role) updateData.role = role;
    if (fullName) updateData.full_name = fullName;

    const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

    if (error) {
        return { message: `Failed to update member: ${error.message}`, success: false };
    }

    revalidatePath('/settings/team');
    return { message: "Team member updated", success: true };
}

export async function deactivateTeamMember(userId: string) {
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return { message: "Unauthorized", success: false };

    // 1. Get Current User Role
    const { data: currentProfile } = await supabase.from('profiles').select('role, warehouse_id').eq('id', currentUser.id).single();
    if (!currentProfile) return { message: "Profile not found", success: false };
    
    const currentRank = roleHierarchy[currentProfile.role] || 0;

    // 2. Get Target User Role
    const { data: targetProfile } = await supabase.from('profiles').select('role, warehouse_id').eq('id', userId).single();
    if (!targetProfile) return { message: "Target user not found", success: false };
    
    const targetRank = roleHierarchy[targetProfile.role] || 0;

    // 3. Permission Check
    if (currentProfile.role !== UserRole.SUPER_ADMIN && currentProfile.warehouse_id !== targetProfile.warehouse_id) {
         return { message: "Unauthorized: Different warehouse", success: false };
    }

    if (currentRank <= targetRank) {
         return { message: "Unauthorized: Insufficient privileges to deactivate this user.", success: false };
    }

    try {
        const { createAdminClient } = await import('@/utils/supabase/admin');
        const supabaseAdmin = createAdminClient();
        
        // Disable user in Auth
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: { is_active: false }, 
        });
        
        if (authError) throw authError;

        // Also update profile
        await supabase.from('profiles').update({
             role: 'suspended' 
        }).eq('id', userId);

        revalidatePath('/settings/team');
        return { message: "Member deactivated", success: true };
    } catch (e: any) {
        logError(e, { operation: 'deactivateTeamMember', metadata: { userId } });
        return { message: `Deactivation failed: ${e.message}`, success: false };
    }
}

export async function fetchTeamMembers() {
    return await getTeamMembers();
}

export async function switchWarehouse(warehouseId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, message: 'Unauthorized' };
    }

    // Verify access
    const { data: membership } = await supabase
        .from('warehouse_assignments')
        .select('role')
        .eq('user_id', user.id)
        .eq('warehouse_id', warehouseId)
        .single();

    if (!membership) {
        return { success: false, message: 'You do not have access to this warehouse.' };
    }

    // Update profile's active warehouse
    const { error } = await supabase
        .from('profiles')
        .update({ 
            warehouse_id: warehouseId,
            role: membership.role 
        })
        .eq('id', user.id);

    if (error) {
        logError(error, { operation: 'switchWarehouse', metadata: { warehouseId } });
        return { success: false, message: 'Failed to switch warehouse.' };
    }

    revalidatePath('/', 'layout');
    return { success: true, message: 'Switched warehouse successfully' };
}

export async function logLoginActivity() {
    try {
        const { logActivity } = await import('@/lib/logger');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;
        
        await logActivity('LOGIN', 'User', user.id);
    } catch (error) {
        logError(error, { operation: 'log_login_activity' });
    }
}
