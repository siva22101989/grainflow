'use server';

import { createClient } from '@/utils/supabase/server';
import { getActiveWarehouseId } from '@/lib/warehouse-actions';

export type SearchResultType = 'customer' | 'record' | 'payment' | 'page';

export interface SearchResult {
    id: string;
    type: SearchResultType;
    title: string;
    subtitle?: string;
    url: string;
    metadata?: Record<string, any>;
}

export async function searchGlobal(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];

    const supabase = await createClient();
    const warehouseId = await getActiveWarehouseId();

    if (!warehouseId) return [];

    const results: SearchResult[] = [];
    const sanitizedQuery = query.trim();
    const isNumber = /^\d+$/.test(sanitizedQuery);

    // 1. Search Customers (Name, Phone)
    const { data: customers } = await supabase
        .from('customers')
        .select('id, name, phone, village')
        .eq('warehouse_id', warehouseId)
        .or(`name.ilike.%${sanitizedQuery}%,phone.ilike.%${sanitizedQuery}%`)
        .limit(5);

    if (customers) {
        customers.forEach(c => {
            results.push({
                id: c.id,
                type: 'customer',
                title: c.name,
                subtitle: c.phone ? `Phone: ${c.phone} • ${c.village || ''}` : c.village,
                url: `/customers/${c.id}`
            });
        });
    }

    // 2. Search Storage Records (Record Number, Commodity)
    let recordQuery = supabase
        .from('storage_records')
        .select('id, record_number, commodity_description, storage_start_date')
        .eq('warehouse_id', warehouseId)
        .is('deleted_at', null)
        .limit(5);

    if (isNumber) {
        // Exact match for record number if query is strictly numeric
        recordQuery = recordQuery.eq('record_number', parseInt(sanitizedQuery));
    } else {
        // Text search for commodity
        recordQuery = recordQuery.ilike('commodity_description', `%${sanitizedQuery}%`);
    }

    const { data: records } = await recordQuery;

    if (records) {
        records.forEach(r => {
            results.push({
                id: r.id,
                type: 'record',
                title: `Record #${r.record_number}`,
                subtitle: `${r.commodity_description} • ${new Date(r.storage_start_date).toLocaleDateString()}`,
                url: `/storage?id=${r.id}`
            });
        });
    }

    // 3. Search Payments (Payment Number, Notes)
    // Payments table has no warehouse_id column. Join through storage_records for isolation.
    let paymentQuery = supabase
        .from('payments')
        .select('id, payment_number, amount, type, notes, payment_date, storage_records!inner(warehouse_id)')
        .eq('storage_records.warehouse_id', warehouseId)
        .is('deleted_at', null)
        .limit(5);

    if (isNumber) {
         paymentQuery = paymentQuery.eq('payment_number', parseInt(sanitizedQuery));
    } else {
         paymentQuery = paymentQuery.ilike('notes', `%${sanitizedQuery}%`);
    }

    const { data: payments } = await paymentQuery;

    if (payments) {
        payments.forEach(p => {
            results.push({
                id: p.id,
                type: 'payment',
                title: `Receipt #${p.payment_number}`,
                subtitle: `₹${p.amount} • ${p.type} • ${new Date(p.payment_date).toLocaleDateString()}`,
                url: `/payments/history?id=${p.id}`
            });
        });
    }

    return results;
}
