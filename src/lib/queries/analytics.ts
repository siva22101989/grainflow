import { createClient } from '@/utils/supabase/server';
import { cache } from 'react';
import { UserRole } from '@/types/db';
import type {
    AdminDashboardStats,
    WarehouseAdminDetails,
    ActivityLogEntry,
    PlatformAnalytics,
    CommodityDistribution
} from '@/lib/definitions';

export const getAdminDashboardStats = cache(async (): Promise<AdminDashboardStats | null> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: profile } = await supabase.from('profiles').select('role, warehouse_id').eq('id', user.id).single();
    if (!profile) return null;
    
    const isSuper = profile.role === UserRole.SUPER_ADMIN;
    const isOwner = profile.role === UserRole.OWNER;
    if (!isSuper && !isOwner) return null; 

    let warehouseIds: string[] = [];
    if (isOwner) {
        const { data: assignments } = await supabase.from('warehouse_assignments').select('warehouse_id').eq('user_id', user.id);
        warehouseIds = assignments?.map(a => a.warehouse_id) || [];
        if (profile.warehouse_id && !warehouseIds.includes(profile.warehouse_id)) {
            warehouseIds.push(profile.warehouse_id);
        }
        if (warehouseIds.length === 0) return null;
    }

    const getCount = async (table: string, filterByWarehouse = false) => {
        let q = supabase.from(table).select('*', { count: 'exact', head: true });
        if (!isSuper && filterByWarehouse && warehouseIds.length > 0) {
            if (table !== 'customers') {
                 q = q.in('warehouse_id', warehouseIds);
            }
        }
        if (table === 'profiles') q = q.neq('role', 'customer');
        if (table === 'storage_records') q = q.is('storage_end_date', null).is('deleted_at', null);
        if (table === 'customers' || table === 'warehouses') q = q.is('deleted_at', null);

        const { count } = await q;
        return count || 0;
    };
    
    let lotsQuery = supabase.from('warehouse_lots').select('current_stock').is('deleted_at', null);
    if (!isSuper && warehouseIds.length > 0) {
        lotsQuery = lotsQuery.in('warehouse_id', warehouseIds);
    }

    const [
        warehouseCount,
        usersCount,
        customersCount,
        activeRecordsCount,
        { data: lots }
    ] = await Promise.all([
        getCount('warehouses', true).then(c => isSuper ? c : warehouseIds.length),
        getCount('profiles', true), 
        getCount('customers', false),
        getCount('storage_records', true),
        lotsQuery
    ]);

    const totalStock = lots?.reduce((sum, lot) => sum + (lot.current_stock || 0), 0) || 0;

    return {
        warehouseCount,
        usersCount,
        customersCount,
        activeRecordsCount,
        totalStock
    };
});

export const getAllWarehousesAdmin = cache(async (limit = 500, offset = 0): Promise<WarehouseAdminDetails[]> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('role, warehouse_id').eq('id', user?.id).single();
    const isOwner = profile?.role === UserRole.OWNER;
    let warehouseIds: string[] = [];
    
    if (isOwner) {
         const { data: assignments } = await supabase.from('warehouse_assignments').select('warehouse_id').eq('user_id', user?.id);
         warehouseIds = assignments?.map(a => a.warehouse_id) || [];
         if (profile?.warehouse_id) warehouseIds.push(profile.warehouse_id);
    }
    
    let query = supabase
        .from('warehouses')
        .select(`
            *,
            warehouse_lots (current_stock, capacity),
            storage_records (id, bags_stored)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (isOwner) {
        if (warehouseIds.length === 0) return [];
        query = query.in('id', warehouseIds);
    }

    const { data, error } = await query;
    if (error) return [];

    return (data || []).map((w: any) => {
        const totalStock = w.storage_records?.reduce((sum: number, record: any) => sum + (record.bags_stored || 0), 0) || 0;
        const totalCapacity = w.warehouse_lots?.reduce((sum: number, lot: any) => sum + (lot.capacity || 0), 0) || w.capacity_bags || 0;
        const activeRecords = (w.storage_records || []).length;

        return {
            ...w,
            totalStock,
            totalCapacity,
            occupancyRate: totalCapacity > 0 ? (totalStock / totalCapacity) * 100 : 0,
            activeRecords
        };
    });
});

export const getAllUsersAdmin = cache(async (limit = 500, offset = 0) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('role, warehouse_id').eq('id', user?.id).single();
    const isOwner = profile?.role === UserRole.OWNER;
    let warehouseIds: string[] = [];
    
    if (isOwner) {
         const { data: assignments } = await supabase.from('warehouse_assignments').select('warehouse_id').eq('user_id', user?.id);
         warehouseIds = assignments?.map(a => a.warehouse_id) || [];
         if (profile?.warehouse_id) warehouseIds.push(profile.warehouse_id);
    }
    
    let query = supabase
        .from('profiles')
        .select(`
            *,
            warehouse:warehouses (name)
        `)
        .neq('role', 'customer')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (isOwner) {
        if (warehouseIds.length === 0) return [];
        query = query.in('warehouse_id', warehouseIds);
    }

    const { data, error } = await query;
    if (error) return [];
    return data;
});

export const getGlobalActivityLogs = cache(async (limit = 20, offset = 0, search = '', filterAction = ''): Promise<ActivityLogEntry[]> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('role, warehouse_id').eq('id', user?.id).single();
    const isOwner = profile?.role === UserRole.OWNER;
    let warehouseIds: string[] = [];
    
    if (isOwner) {
         const { data: assignments } = await supabase.from('warehouse_assignments').select('warehouse_id').eq('user_id', user?.id);
         warehouseIds = assignments?.map(a => a.warehouse_id) || [];
         if (profile?.warehouse_id) warehouseIds.push(profile.warehouse_id);
    }
    
    let query = supabase
        .from('audit_logs')
        .select(`
            *,
            user:profiles (full_name, email),
            warehouse:warehouses (name)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (isOwner) {
        if (warehouseIds.length === 0) return [];
        query = query.in('warehouse_id', warehouseIds);
    }

    if (search) {
        query = query.or(`action.ilike.%${search}%,entity.ilike.%${search}%,entity_id.ilike.%${search}%`);
    }

    if (filterAction && filterAction !== 'all') {
        if (filterAction === 'important') {
             query = query.neq('action', 'LOGIN');
        } else {
             query = query.eq('action', filterAction);
        }
    }

    const { data, error } = await query;
    if (error) return [];
    return data;
});

export const getPlatformAnalytics = cache(async (): Promise<PlatformAnalytics> => {
    const supabase = await createClient();
    const { data: warehouses } = await supabase
        .from('warehouses')
        .select('created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    const { data: users } = await supabase
        .from('profiles')
        .select('created_at')
        .order('created_at', { ascending: true });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const warehouseData = (warehouses || []).reduce((acc: Record<string, number>, w: any) => {
        const month = months[new Date(w.created_at).getMonth()] || 'Unknown';
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {});

    const userData = (users || []).reduce((acc: Record<string, number>, u: any) => {
        const month = months[new Date(u.created_at).getMonth()] || 'Unknown';
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {});

    const chartData = months.map(m => ({
        month: m,
        warehouses: warehouseData[m] || 0,
        users: userData[m] || 0
    })).filter(m => m.warehouses > 0 || m.users > 0);

    const { data: stocks } = await supabase
        .from('storage_records')
        .select('commodity_description, bags_stored')
        .is('storage_end_date', null)
        .is('deleted_at', null);

    const commodityDistribution = (stocks || []).reduce((acc: CommodityDistribution[], s: any) => {
        const name = s.commodity_description || 'Unknown';
        const existing = acc.find((item: any) => item.name === name);
        if (existing) {
            existing.value += (s.bags_stored || 0);
        } else {
            acc.push({ name, value: (s.bags_stored || 0) });
        }
        return acc;
    }, []).sort((a: any, b: any) => b.value - a.value).slice(0, 5);

    return {
        growthData: chartData.slice(-6),
        commodityDistribution: commodityDistribution.length > 0 ? commodityDistribution : [
            { name: 'Paddy', value: 400 },
            { name: 'Maize', value: 300 },
            { name: 'Wheat', value: 200 },
            { name: 'Sugar', value: 100 },
        ]
    };
});
