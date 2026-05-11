
import { createClient } from '@/utils/supabase/server';
import { cache } from 'react';

type PortfolioItem = {
    warehouseName: string;
    warehouseLocation: string;
    warehouseGst?: string;
    totalBags: number;
    totalPaid: number;
    totalBilled: number;
    records: any[];
};

export const getCustomerPortfolio = cache(async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // 1. Find all Customer Profiles linked to this User
    const { data: customers } = await supabase
        .from('customers')
        .select(`
            id, 
            name,
            warehouse_id, 
            warehouses (name, location, gst_number)
        `)
        .eq('linked_user_id', user.id);

    if (!customers || customers.length === 0) return [];

    const customerIds = customers.map(c => c.id);
    
    // Create a map for quick access
    const customerMap = new Map(customers.map(c => [c.id, c.name]));

    // 2. Fetch Storage Records and their Payments
    const { data: records } = await supabase
        .from('storage_records')
        .select(`
            *,
            crops (name),
            warehouse_lots (name),
            payments (*),
            withdrawal_transactions (*)
        `)
        .in('customer_id', customerIds)
        .order('storage_start_date', { ascending: false });

    if (!records) return [];

    // 3. Aggregate by Warehouse
    const portfolio: Record<string, PortfolioItem> = {};

    customers.forEach(c => {
        if (!portfolio[c.warehouse_id]) {
            // @ts-ignore
            const wName = c.warehouses?.name || 'Unknown Warehouse';
            // @ts-ignore
            const wLoc = c.warehouses?.location || '';
            // @ts-ignore
            const wGst = c.warehouses?.gst_number || undefined;
            
            portfolio[c.warehouse_id] = {
                warehouseName: wName,
                warehouseLocation: wLoc,
                warehouseGst: wGst,
                totalBags: 0,
                totalPaid: 0,
                totalBilled: 0,
                records: []
            };
        }
    });

    records.forEach(r => {
        const whId = r.warehouse_id;
        if (portfolio[whId]) {
            // Calculate payments for this record
            const recordPayments = r.payments || [];
            const recordPaid = recordPayments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
            
            // Customer sees the FULL amount they owe: rent + hamali + insurance.
            // Previously only rent was included, so the portal under-reported
            // their balance.
            const recordBilled =
                (r.total_rent_billed || 0) +
                (r.hamali_payable || 0) +
                (r.insurance_payable || 0);

            const enrichedRecord = {
                ...r,
                paid: recordPaid,
                billed: recordBilled,
                is_active: r.storage_end_date === null,
                // @ts-ignore
                lot_name: r.warehouse_lots?.name || r.lot_id || 'N/A',
                // Explicit mapping for Receipts
                customerName: customerMap.get(r.customer_id) || 'Valued Customer',
                commodityDescription: r.commodity_description || r.crops?.name || 'N/A'
            };

            portfolio[whId].records.push(enrichedRecord);
            
            if (enrichedRecord.is_active) {
                portfolio[whId].totalBags += (r.bags_stored || 0);
            }
            portfolio[whId].totalPaid += recordPaid;
            portfolio[whId].totalBilled += recordBilled;
        }
    });

    return Object.values(portfolio).sort((a, b) => b.totalBags - a.totalBags);
});
