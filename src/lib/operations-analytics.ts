import { createClient } from '@/utils/supabase/server';
import { getUserWarehouse } from './queries';

export interface CapacityMetrics {
    totalCapacity: number;
    currentOccupancy: number;
    utilizationRate: number;
    availableSpace: number;
}

export interface LotUtilization {
    lotId: string;
    lotName: string;
    capacity: number;
    currentStock: number;
    utilizationRate: number;
}

export interface TurnoverMetrics {
    averageStorageDuration: number;
    totalInflows: number;
    totalOutflows: number;
    turnoverRate: number;
}

export interface CommodityMetrics {
    commodityId: string;
    commodityName: string;
    totalBags: number;
    averageDuration: number;
    revenue: number;
}

export interface CustomerBehavior {
    repeatCustomerRate: number;
    averageBagsPerTransaction: number;
    activeCustomers: number;
    totalCustomers: number;
}

/**
 * Get overall capacity metrics
 */
export async function getCapacityMetrics(): Promise<CapacityMetrics> {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) {
        return {
            totalCapacity: 0,
            currentOccupancy: 0,
            utilizationRate: 0,
            availableSpace: 0
        };
    }

    const { data: lots } = await supabase
        .from('warehouse_lots')
        .select('capacity, current_stock')
        .eq('warehouse_id', warehouseId);

    if (!lots) return {
        totalCapacity: 0,
        currentOccupancy: 0,
        utilizationRate: 0,
        availableSpace: 0
    };

    const totalCapacity = lots.reduce((sum, lot) => sum + (lot.capacity || 0), 0);
    const currentOccupancy = lots.reduce((sum, lot) => sum + (lot.current_stock || 0), 0);
    const utilizationRate = totalCapacity > 0 ? (currentOccupancy / totalCapacity) * 100 : 0;
    const availableSpace = totalCapacity - currentOccupancy;

    return {
        totalCapacity,
        currentOccupancy,
        utilizationRate,
        availableSpace
    };
}

/**
 * Get utilization by lot
 */
export async function getLotUtilization(): Promise<LotUtilization[]> {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) return [];

    const { data: lots } = await supabase
        .from('warehouse_lots')
        .select('id, name, capacity, current_stock')
        .eq('warehouse_id', warehouseId)
        .order('name');

    if (!lots) return [];

    return lots.map(lot => ({
        lotId: lot.id,
        lotName: lot.name,
        capacity: lot.capacity || 0,
        currentStock: lot.current_stock || 0,
        utilizationRate: lot.capacity > 0 ? ((lot.current_stock || 0) / lot.capacity) * 100 : 0
    }));
}

/**
 * Get inventory turnover metrics
 */
export async function getTurnoverMetrics(): Promise<TurnoverMetrics> {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) {
        return {
            averageStorageDuration: 0,
            totalInflows: 0,
            totalOutflows: 0,
            turnoverRate: 0
        };
    }

    const { data: records } = await supabase
        .from('storage_records')
        .select('storage_start_date, storage_end_date, bags_stored')
        .eq('warehouse_id', warehouseId);

    if (!records) return {
        averageStorageDuration: 0,
        totalInflows: 0,
        totalOutflows: 0,
        turnoverRate: 0
    };

    const totalInflows = records.length;
    const completedRecords = records.filter(r => r.storage_end_date);
    const totalOutflows = completedRecords.length;

    // Calculate average storage duration for completed records
    let totalDays = 0;
    completedRecords.forEach(r => {
        const start = new Date(r.storage_start_date);
        const end = new Date(r.storage_end_date);
        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        totalDays += days;
    });

    const averageStorageDuration = completedRecords.length > 0 ? totalDays / completedRecords.length : 0;
    const turnoverRate = totalInflows > 0 ? (totalOutflows / totalInflows) * 100 : 0;

    return {
        averageStorageDuration,
        totalInflows,
        totalOutflows,
        turnoverRate
    };
}

/**
 * Get metrics by commodity
 */
export async function getCommodityMetrics(): Promise<CommodityMetrics[]> {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) return [];

    const { data: records } = await supabase
        .from('storage_records')
        .select(`
            crop_id,
            commodity_description,
            bags_stored,
            storage_start_date,
            storage_end_date,
            hamali_payable,
            insurance_payable,
            total_rent_billed
        `)
        .eq('warehouse_id', warehouseId);

    if (!records) return [];

    // Group by commodity
    const commodityMap = new Map<string, {
        name: string;
        totalBags: number;
        totalDays: number;
        recordCount: number;
        revenue: number;
    }>();

    records.forEach((r: any) => {
        const key = r.crop_id || r.commodity_description || 'Unknown';
        const name = r.commodity_description || 'Unknown';
        
        const existing = commodityMap.get(key) || {
            name,
            totalBags: 0,
            totalDays: 0,
            recordCount: 0,
            revenue: 0
        };

        existing.totalBags += r.bags_stored || 0;
        existing.revenue +=
            (r.hamali_payable || 0) +
            (r.total_rent_billed || 0) +
            (r.insurance_payable || 0);
        existing.recordCount++;

        // Calculate duration if completed
        if (r.storage_end_date) {
            const start = new Date(r.storage_start_date);
            const end = new Date(r.storage_end_date);
            const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            existing.totalDays += days;
        }

        commodityMap.set(key, existing);
    });

    // Convert to array
    return Array.from(commodityMap.entries())
        .map(([id, data]) => ({
            commodityId: id,
            commodityName: data.name,
            totalBags: data.totalBags,
            averageDuration: data.recordCount > 0 ? data.totalDays / data.recordCount : 0,
            revenue: data.revenue
        }))
        .sort((a, b) => b.totalBags - a.totalBags);
}

/**
 * Get customer behavior metrics
 */
export async function getCustomerBehavior(): Promise<CustomerBehavior> {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) {
        return {
            repeatCustomerRate: 0,
            averageBagsPerTransaction: 0,
            activeCustomers: 0,
            totalCustomers: 0
        };
    }

    const [customersResult, recordsResult] = await Promise.all([
        supabase
            .from('customers')
            .select('id')
            .eq('warehouse_id', warehouseId),
        supabase
            .from('storage_records')
            .select('customer_id, bags_stored, storage_end_date')
            .eq('warehouse_id', warehouseId)
    ]);

    const totalCustomers = customersResult.data?.length || 0;
    const records = recordsResult.data || [];

    // Count unique customers with records
    const customersWithRecords = new Set(records.map(r => r.customer_id));
    const activeCustomers = customersWithRecords.size;

    // Count customers with multiple transactions
    const customerTransactionCount = new Map<string, number>();
    records.forEach(r => {
        const count = customerTransactionCount.get(r.customer_id) || 0;
        customerTransactionCount.set(r.customer_id, count + 1);
    });

    const repeatCustomers = Array.from(customerTransactionCount.values()).filter(count => count > 1).length;
    const repeatCustomerRate = activeCustomers > 0 ? (repeatCustomers / activeCustomers) * 100 : 0;

    // Calculate average bags per transaction
    const totalBags = records.reduce((sum, r) => sum + (r.bags_stored || 0), 0);
    const averageBagsPerTransaction = records.length > 0 ? totalBags / records.length : 0;

    return {
        repeatCustomerRate,
        averageBagsPerTransaction,
        activeCustomers,
        totalCustomers
    };
}
