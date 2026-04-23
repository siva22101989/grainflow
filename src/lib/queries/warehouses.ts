import { createClient } from '@/utils/supabase/server';
import { cache } from 'react';
import type { UserWarehouse } from '@/lib/definitions';
import { getAuthUser } from './auth';
import { logError } from '@/lib/error-logger';


// Helper to get current user's warehouse.
// Resolution order: user_metadata → profiles.warehouse_id → warehouse_assignments.
// The assignments fallback is critical — some owners have profile.warehouse_id NULL
// but still have a valid row in warehouse_assignments (e.g., created via signup trigger
// or invited as a team member). Without this fallback, /settings, /inflow, /outflow,
// /storage, and other pages silently return empty data for them.
export const getUserWarehouse = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. Try Metadata (Fastest)
  const metaWarehouseId = user.user_metadata?.warehouse_id;
  if (metaWarehouseId) return metaWarehouseId;

  // 2. DB Fallback — profiles.warehouse_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('warehouse_id')
    .eq('id', user.id)
    .single();

  if (profile?.warehouse_id) {
     return profile.warehouse_id;
  }

  // 3. DB Fallback — warehouse_assignments (for users without profile.warehouse_id)
  const { data: assignment } = await supabase
    .from('warehouse_assignments')
    .select('warehouse_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assignment?.warehouse_id) {
    return assignment.warehouse_id;
  }

  return null;
});

export const getCurrentUserRole = cache(async () => {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role;
});

export const hasCustomerProfile = cache(async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('linked_user_id', user.id);
    
    return (count || 0) > 0;
});

export const getUserWarehouses = cache(async (): Promise<UserWarehouse[]> => {
    const supabase = await createClient();
    const user = await getAuthUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('warehouse_assignments')
        .select(`
            id,
            user_id,
            warehouse_id,
            warehouse:warehouses (
                id,
                name,
                location,
                capacity_bags,
                created_at
            )
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null); // Only get active assignments
        
    if (error) {
        console.error('Error fetching warehouse assignments:', error);
        return [];
    }
    
    if (!data) return [];

    // Fetch user's role from profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    
    if (profileError) {
        console.error('Error fetching profile:', profileError);
    }

    return data.map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        warehouseId: item.warehouse_id,
        role: profile?.role, // Use profiles.role as single source of truth
        warehouse: Array.isArray(item.warehouse) ? item.warehouse[0] : item.warehouse
    }));
});

export const getWarehouseDetails = cache(async () => {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();
  if (!warehouseId) return null;

  const { data } = await supabase
    .from('warehouses')
    .select('*')
    .eq('id', warehouseId)
    .single();

  return data;
});

export const getAvailableCrops = cache(async () => {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return [];

    const { data } = await supabase.from('crops').select('*').eq('warehouse_id', warehouseId).order('name');
    return data || [];
});

export const getAvailableLots = cache(async () => {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return [];

    const { data } = await supabase.from('warehouse_lots').select('*').eq('warehouse_id', warehouseId).is('deleted_at', null).order('name');
    return data || [];
});

export const getTeamMembers = cache(async () => {
    const supabase = await createClient();
    const userRole = await getCurrentUserRole();
    const warehouseId = await getUserWarehouse();
    
    // Debug logging removed for production
    
    if (userRole === 'super_admin') {
         const { data: allProfiles, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, created_at')
            .neq('role', 'customer')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[getTeamMembers] SuperAdmin Error:', error);
            return [];
        }

        return allProfiles.map((p) => ({
            id: p.id,
            email: p.email!,
            fullName: p.full_name!,
            role: p.role!,
            createdAt: p.created_at ? new Date(p.created_at) : new Date(),
        }));
    }

    if (!warehouseId) return [];

    // 1. Get assignments first
    const { data: assignments, error: assignmentError } = await supabase
        .from('warehouse_assignments')
        .select('user_id, created_at')
        .eq('warehouse_id', warehouseId);

    if (assignmentError) {
        logError(assignmentError, { operation: 'getTeamMembers_assignments' });
        return [];
    }

    if (!assignments || assignments.length === 0) return [];

    const userIds = assignments.map(a => a.user_id);

    // 2. Get profiles for these users
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at')
        .in('id', userIds);

    if (profileError) {
         logError(profileError, { operation: 'getTeamMembers_profiles' });
         return [];
    }

    // 3. Merge data
    const members = assignments.map((assignment: any) => {
        const profile = profiles?.find(p => p.id === assignment.user_id);
        
        if (!profile) return null; // Should not happen if data is consistent
        if (profile.role === 'customer') return null; // Filter customers

        return {
            id: profile.id,
            email: profile.email,
            fullName: profile.full_name,
            role: profile.role, // Use profiles.role as single source of truth
            createdAt: new Date(assignment.created_at || profile.created_at), // Use assignment time if available
        };
    }).filter(Boolean);

    // Sort by newest first
    return members.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
});

export async function getMemberAssignments(userId: string) {
    const supabase = await createClient();
    
    // Get warehouse assignments
    const { data: assignments, error } = await supabase
        .from('warehouse_assignments')
        .select('warehouse_id')
        .eq('user_id', userId);
    
    if (error) return [];
    
    // Get user's role from profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
    
    // Return assignments with role from profile
    return assignments?.map(a => ({
        warehouse_id: a.warehouse_id,
        role: profile?.role // Use profiles.role as single source of truth
    })) || [];
}
