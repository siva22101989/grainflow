import { createClient } from '@/utils/supabase/server';
import { getUserWarehouse } from './queries';

export interface RevenueMetrics {
    totalRevenue: number;
    rentRevenue: number;
    hamaliRevenue: number;
    totalPaid: number;
    totalOutstanding: number;
}

export interface MonthlyRevenue {
    month: string;
    rent: number;
    hamali: number;
    total: number;
}

export interface CustomerRevenue {
    customerId: string;
    customerName: string;
    totalRevenue: number;
    rentRevenue: number;
    hamaliRevenue: number;
    amountPaid: number;
    outstanding: number;
}

export interface AgingAnalysis {
    range: string;
    count: number;
    amount: number;
}

// Type definitions for internal usage
interface Payment {
    amount: number;
    payment_date?: string;
}

interface RecordWithPayments {
    storage_start_date: string;
    hamali_payable: number | null;
    insurance_payable?: number | null;
    total_rent_billed: number | null;
    customer_id?: string;
    customers?: { name: string };
    payments: Payment[] | null;
}

/**
 * Get overall revenue metrics
 */
export async function getRevenueMetrics(): Promise<RevenueMetrics> {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) {
        return {
            totalRevenue: 0,
            rentRevenue: 0,
            hamaliRevenue: 0,
            totalPaid: 0,
            totalOutstanding: 0
        };
    }

    // Get all storage records with payments
    const { data: records, error } = await supabase
        .from('storage_records')
        .select('hamali_payable, insurance_payable, total_rent_billed, payments(amount)')
        .eq('warehouse_id', warehouseId);

    if (error || !records) {
        return {
            totalRevenue: 0,
            rentRevenue: 0,
            hamaliRevenue: 0,
            totalPaid: 0,
            totalOutstanding: 0
        };
    }

    let rentRevenue = 0;
    let hamaliRevenue = 0;
    let totalPaid = 0;

    let insuranceRevenue = 0;
    records.forEach((r) => {
        const record = r as unknown as RecordWithPayments;
        rentRevenue += record.total_rent_billed || 0;
        hamaliRevenue += record.hamali_payable || 0;
        insuranceRevenue += record.insurance_payable || 0;

        const payments = record.payments || [];
        totalPaid += payments.reduce((sum: number, p: Payment) => sum + (p.amount || 0), 0);
    });

    const totalRevenue = rentRevenue + hamaliRevenue + insuranceRevenue;
    return {
        totalRevenue,
        rentRevenue,
        hamaliRevenue,
        totalPaid,
        totalOutstanding: totalRevenue - totalPaid
    };
}

export async function getMonthlyRevenueTrends(): Promise<MonthlyRevenue[]> {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return [];

    const { data: records } = await supabase
        .from('storage_records')
        .select('storage_start_date, hamali_payable, total_rent_billed')
        .eq('warehouse_id', warehouseId);

    if (!records) return [];

    const monthlyData = new Map<string, { rent: number; hamali: number }>();

    records.forEach((r) => {
        const record = r as unknown as RecordWithPayments;
        if (!record.storage_start_date) return;

        const date = new Date(record.storage_start_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        const existing = monthlyData.get(monthKey) || { rent: 0, hamali: 0 };
        existing.rent += record.total_rent_billed || 0;
        existing.hamali += record.hamali_payable || 0;
        monthlyData.set(monthKey, existing);
    });

    return Array.from(monthlyData.entries())
        .map(([month, data]) => ({
            month,
            rent: data.rent,
            hamali: data.hamali,
            total: data.rent + data.hamali
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
}

export async function getTopCustomersByRevenue(limit = 5): Promise<CustomerRevenue[]> {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return [];

    const { data: records } = await supabase
        .from('storage_records')
        .select('customer_id, customers(name), hamali_payable, total_rent_billed, payments(amount)')
        .eq('warehouse_id', warehouseId);

    if (!records) return [];

    const customerMap = new Map<string, CustomerRevenue>();

    records.forEach((r) => {
        const record = r as unknown as RecordWithPayments;
        const customerId = record.customer_id;
        const customerName = record.customers?.name || 'Unknown';
        
        if (!customerId) return;

        const existing = customerMap.get(customerId) || {
            customerId,
            customerName,
            totalRevenue: 0,
            rentRevenue: 0,
            hamaliRevenue: 0,
            amountPaid: 0,
            outstanding: 0
        };

        existing.rentRevenue += record.total_rent_billed || 0;
        existing.hamaliRevenue += record.hamali_payable || 0;
        
        const payments = record.payments || [];
        existing.amountPaid += payments.reduce((sum: number, p: Payment) => sum + (p.amount || 0), 0);

        customerMap.set(customerId, existing);
    });

    return Array.from(customerMap.values())
        .map(c => {
            c.totalRevenue = c.rentRevenue + c.hamaliRevenue;
            c.outstanding = c.totalRevenue - c.amountPaid;
            return c;
        })
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);
}

export async function getAgingAnalysis(): Promise<AgingAnalysis[]> {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return [];

    const { data: records } = await supabase
        .from('storage_records')
        .select('storage_start_date, hamali_payable, insurance_payable, total_rent_billed, payments(amount)')
        .eq('warehouse_id', warehouseId);

    if (!records) return [];

    const aging = {
        '0-30': { range: '0-30 Days', count: 0, amount: 0 },
        '30-60': { range: '30-60 Days', count: 0, amount: 0 },
        '60-90': { range: '60-90 Days', count: 0, amount: 0 },
        '90+': { range: '90+ Days', count: 0, amount: 0 }
    };

    const now = new Date();

    records.forEach((r) => {
        const record = r as unknown as RecordWithPayments;
        const totalBilled = (record.hamali_payable || 0) + (record.insurance_payable || 0) + (record.total_rent_billed || 0);
        const payments = record.payments || [];
        const amountPaid = payments.reduce((sum: number, p: Payment) => sum + (p.amount || 0), 0);
        const outstanding = totalBilled - amountPaid;

        if (outstanding <= 0) return; // Skip paid records
        if (!record.storage_start_date) return;

        const startDate = new Date(record.storage_start_date);
        const daysOld = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOld <= 30) {
            aging['0-30'].count++;
            aging['0-30'].amount += outstanding;
        } else if (daysOld <= 60) {
            aging['30-60'].count++;
            aging['30-60'].amount += outstanding;
        } else if (daysOld <= 90) {
            aging['60-90'].count++;
            aging['60-90'].amount += outstanding;
        } else {
            aging['90+'].count++;
            aging['90+'].amount += outstanding;
        }
    });

    return Object.values(aging);
}

export async function getCollectionMetrics() {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return { collectionRate: 0, averageDaysToPayment: 0, totalCollected: 0, totalBilled: 0 };

    const { data: records } = await supabase
        .from('storage_records')
        .select('storage_start_date, hamali_payable, insurance_payable, total_rent_billed, payments(amount, payment_date)')
        .eq('warehouse_id', warehouseId);

    if (!records) return { collectionRate: 0, averageDaysToPayment: 0, totalCollected: 0, totalBilled: 0 };

    let totalBilled = 0;
    let totalCollected = 0;
    let totalDays = 0;
    let paymentCount = 0;

    records.forEach((r) => {
        const record = r as unknown as RecordWithPayments;
        const billed = (record.hamali_payable || 0) + (record.insurance_payable || 0) + (record.total_rent_billed || 0);
        totalBilled += billed;

        const payments = record.payments || [];
        payments.forEach((p: Payment) => {
            totalCollected += p.amount || 0;
            
            if (p.payment_date && record.storage_start_date) {
                // Calculate days to payment
                const startDate = new Date(record.storage_start_date);
                const paymentDate = new Date(p.payment_date);
                const days = Math.floor((paymentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (days >= 0) {
                    totalDays += days;
                    paymentCount++;
                }
            }
        });
    });

    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;
    const averageDaysToPayment = paymentCount > 0 ? totalDays / paymentCount : 0;

    return {
        collectionRate,
        averageDaysToPayment,
        totalCollected,
        totalBilled
    };
}
