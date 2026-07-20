import { createClient } from '@/utils/supabase/server';
import { cache } from 'react';
import type { StorageRecord } from '@/lib/definitions';
import type { StorageQueryOptions } from '@/lib/types/query-options';
import { logError } from '@/lib/error-logger';
import { getUserWarehouse } from './warehouses';
import { measureQuery } from '@/lib/utils/query-logger';

/**
 * Fetches high-level metrics for the dashboard view.
 * Calculates total capacity, total stock, active record count, and pending revenue.
 * 
 * @returns {Promise<{totalCapacity: number, totalStock: number, occupancyRate: number, activeRecordsCount: number, pendingRevenue: number} | null>} Dashboard metrics.
 */
export const getDashboardMetrics = cache(async () => {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return null;

    const { data: lots } = await supabase.from('warehouse_lots').select('capacity, current_stock').eq('warehouse_id', warehouseId).is('deleted_at', null);
    const { count: activeRecordsCount } = await supabase
        .from('storage_records')
        .select('*', { count: 'exact', head: true })
        .eq('warehouse_id', warehouseId)
        .is('storage_end_date', null)
        .is('deleted_at', null);

    // "In Drying" = Plot inflow whose loadBags hasn't been finalized yet.
    // These records inflate Total Stock by their drying-loss component, so we
    // surface them separately on the dashboard and let users filter the storage
    // page by them.
    const { data: dryingRows, count: dryingCount } = await supabase
        .from('storage_records')
        .select('plot_bags, bags_stored, created_at', { count: 'exact' })
        .eq('warehouse_id', warehouseId)
        .eq('inflow_type', 'transfer_in')
        .is('storage_end_date', null)
        .is('deleted_at', null)
        .or('load_bags.is.null,load_bags.eq.0');

    let dryingBags = 0;
    let staleDryingCount = 0; // unfinalized for >7 days
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (dryingRows) {
        for (const r of dryingRows as any[]) {
            dryingBags += Number(r.plot_bags ?? r.bags_stored ?? 0);
            if (r.created_at && now - new Date(r.created_at).getTime() > SEVEN_DAYS_MS) {
                staleDryingCount++;
            }
        }
    }

    let totalCapacity = 0;
    let totalStock = 0;
    if (lots) {
        totalCapacity = lots.reduce((acc, lot) => acc + (lot.capacity || 1000), 0);
        totalStock = lots.reduce((acc, lot) => acc + (lot.current_stock || 0), 0);
    }
    // Confirmed stock = total stock minus what's still drying (not yet committed).
    const confirmedStock = Math.max(0, totalStock - dryingBags);

    // Calculate pending revenue (total dues - total paid)
    const { data: revenueRecords } = await supabase
        .from('storage_records')
        .select(`
            hamali_payable,
            insurance_payable,
            withdrawal_transactions (rent_collected, deleted_at),
            payments (amount, deleted_at)
        `)
        .eq('warehouse_id', warehouseId)
        .is('deleted_at', null);

    let totalDues = 0;
    let totalPaid = 0;

    revenueRecords?.forEach((r: any) => {
        // Calculate actual rent from non-deleted withdrawal transactions only
        const withdrawals = (r.withdrawal_transactions || []).filter((w: any) => !w.deleted_at);
        const rentFromWithdrawals = withdrawals.reduce((sum: number, w: any) =>
            sum + (parseFloat(w.rent_collected) || 0), 0);

        totalDues +=
            rentFromWithdrawals +
            (r.hamali_payable || 0) +
            (r.insurance_payable || 0);

        // Sum all non-deleted payments (rent + hamali + insurance + other)
        const payments = (r.payments || []).filter((p: any) => !p.deleted_at);
        totalPaid += payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    });

    const pendingRevenue = Math.max(0, totalDues - totalPaid);

    return {
        totalCapacity,
        totalStock,
        confirmedStock,
        dryingBags,
        dryingCount: dryingCount || 0,
        staleDryingCount,
        occupancyRate: totalCapacity > 0 ? (totalStock / totalCapacity) * 100 : 0,
        activeRecordsCount: activeRecordsCount || 0,
        pendingRevenue
    };
});

/**
 * Helper function to map database storage records to the frontend `StorageRecord` type.
 * Also recalculates `bagsStored` dynamically to ensure data integrity against corrupt historical entries.
 * 
 * @param {any[]} records - Raw database records.
 * @returns {StorageRecord[]} Array of mapped storage records.
 */
export function mapRecords(records: any[]): StorageRecord[] {
  return records.map((r: any) => {
    // Calculate total withdrawn bags from withdrawal transactions
    const withdrawals = r.withdrawal_transactions || [];
    const totalWithdrawn = withdrawals
      .filter((w: any) => !w.deleted_at) // Exclude soft-deleted withdrawals
      .reduce((sum: number, w: any) => sum + (w.bags_withdrawn || 0), 0);
    
    const initialStock = (r.bags_in !== null && r.bags_in !== undefined) 
      ? r.bags_in 
      : (r.bags_stored + totalWithdrawn);
    
    // Dynamically calculate current stock to fix any data corruption where bags_stored wasn't updated
    const currentStock = Math.max(0, initialStock - totalWithdrawn);

    return {
      id: r.id,
      recordNumber: r.record_number,
      customerId: r.customer_id,
      customerNumber: r.customer?.customer_number ?? null,
      customerName: r.customer?.name || 'Unknown',
      cropId: r.crop_id,
      lotId: r.lot_id, // Added for capacity checks
      commodityDescription: r.commodity_description,
      location: r.location,
      bagsIn: initialStock,
      bagsOut: totalWithdrawn, // Actual withdrawn bags from transactions
      bagsStored: currentStock, // Use calculated stock instead of potentially stale DB value
      storageStartDate: new Date(r.storage_start_date),
      storageEndDate: r.storage_end_date ? new Date(r.storage_end_date) : null,
      billingCycle: r.billing_cycle,
      payments: (r.payments || []).filter((p: any) => !p.deleted_at).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        date: new Date(p.payment_date),
        type: p.type || 'other',
        notes: p.notes,
        paymentNumber: p.payment_number
      })),
      hamaliPayable: r.hamali_payable,
      insurancePayable: r.insurance_payable ?? 0,
      totalRentBilled: r.total_rent_billed,
      outflowInvoiceNo: r.outflow_invoice_no,
      lorryTractorNo: r.lorry_tractor_no,
      inflowType: r.inflow_type,
      plotBags: r.plot_bags,
      loadBags: r.load_bags,
      khataAmount: r.khata_amount,
      // Expose updated_at so date-filtered views (customer detail, statement)
      // can include records that were TOUCHED recently even if their
      // storage_start/end dates are back-dated. Bulk outflow back-dating
      // would otherwise hide a record from "this month" filters.
      updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
      // Non-deleted withdrawals on this record. Surfaced so the Customer
      // Statement modal/PDF can build a chronological ledger and group
      // bulk-outflow batches by consolidated_invoice_no.
      withdrawals: (r.withdrawal_transactions || [])
        .filter((w: any) => !w.deleted_at)
        .map((w: any) => ({
          id: w.id,
          date: new Date(w.withdrawal_date),
          bagsWithdrawn: w.bags_withdrawn,
          rentCollected: Number(w.rent_collected || 0),
          consolidatedInvoiceNo: w.consolidated_invoice_no || null,
          batchId: w.batch_id || null,
        })),
    };
  });
}

/**
 * Query builder helper to construct common storage record queries.
 * Handles joins for payments, customers, and withdrawal transactions.
 * 
 * @param {any} supabase - Supabase client instance.
 * @param {string} warehouseId - The warehouse UUID.
 * @param {StorageQueryOptions} [options={}] - Query filtering and inclusion options.
 * @returns {any} A Supabase query builder object.
 */
function buildStorageRecordsQuery(
  supabase: any,
  warehouseId: string,
  options: StorageQueryOptions = {}
) {
  const {
    activeOnly = false,
    customerId,
    includePayments = true,
    includeCustomer = true
  } = options;

  // Build select clause
  const selectParts = ['*'];
  if (includePayments) selectParts.push('payments (*)');
  if (includeCustomer) selectParts.push('customer:customers(name, customer_number)');
  // Include withdrawal transactions to calculate actual remaining stock
  // AND to drive chronological ledger views (Customer Statement etc.).
  // id + withdrawal_date + rent_collected + consolidated_invoice_no/batch_id
  // let downstream code group bulk batches into single ledger rows.
  selectParts.push('withdrawal_transactions (id, bags_withdrawn, withdrawal_date, rent_collected, deleted_at, consolidated_invoice_no, batch_id)');

  let query = supabase
    .from('storage_records')
    .select(selectParts.join(', '))
    .eq('warehouse_id', warehouseId);

  // Apply filters
  if (activeOnly) {
    query = query.gt('bags_stored', 0);
  }
  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  return query.is('deleted_at', null);
}


/**
 * Fetches all storage records for a warehouse with pagination.
 * 
 * @param {number} [limit=20] - Number of records to return.
 * @param {number} [offset=0] - Number of records to skip.
 * @returns {Promise<StorageRecord[]>} Array of storage records.
 */
export const getStorageRecords = cache(async (limit = 20, offset = 0): Promise<StorageRecord[]> => {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();
  
  if (!warehouseId) return [];

  return measureQuery(
    'getStorageRecords',
    'fetch_storage_records',
    async () => {
      const { data: records, error } = await buildStorageRecordsQuery(supabase, warehouseId)
        .order('storage_start_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logError(error, { operation: 'fetch_storage_records', warehouseId });
        return [];
      }

      return mapRecords(records);
    },
    { limit, offset, warehouseId }
  );
});

/**
 * Fetches only active storage records (where stock > 0) with pagination.
 * 
 * @param {number} [limit=20] - Number of records to return.
 * @param {number} [offset=0] - Number of records to skip.
 * @returns {Promise<StorageRecord[]>} Array of active storage records.
 */
/**
 * Calculates total historical inflow, outflow, and current balance stock across the warehouse.
 * 
 * @returns {Promise<{totalInflow: number, totalOutflow: number, balanceStock: number}>} Overall stock statistics.
 */
export const getStorageStats = cache(async () => {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return { totalInflow: 0, totalOutflow: 0, balanceStock: 0 };

    const { data, error } = await supabase
        .from('storage_records')
        .select('bags_in, bags_out, bags_stored')
        .eq('warehouse_id', warehouseId)
        .is('deleted_at', null);

    if (error || !data) return { totalInflow: 0, totalOutflow: 0, balanceStock: 0 };

    const totalInflow = data.reduce((acc, r) => acc + (r.bags_in || 0), 0);
    const totalOutflow = data.reduce((acc, r) => acc + (r.bags_out || 0), 0);
    const balanceStock = data.reduce((acc, r) => acc + (r.bags_stored || 0), 0); 
    
    return {
        totalInflow,
        totalOutflow,
        balanceStock
    };
});

/**
 * Retrieves a single storage record by ID, including its related entities.
 * 
 * @param {string} id - The UUID of the storage record.
 * @returns {Promise<StorageRecord | null>} The storage record details or null.
 */
export const getStorageRecord = cache(async (id: string): Promise<StorageRecord | null> => {
  const supabase = await createClient();
  const { data: r, error } = await supabase
    .from('storage_records')
    .select(`
      *,
      payments (*),
      customer:customers(name, customer_number),
      withdrawal_transactions (bags_withdrawn, deleted_at)
    `)
    .eq('id', id)
    .single();

  if (error || !r) return null;

  // Use shared mapping helper
  return mapRecords([r])[0] || null;
});

/**
 * Fetches all storage records for a specific customer.
 * 
 * @param {string} customerId - The UUID of the customer.
 * @param {number} [limit=200] - Max records to return.
 * @param {number} [offset=0] - Pagination offset.
 * @returns {Promise<StorageRecord[]>} Array of customer's storage records.
 */
export async function getCustomerRecords(customerId: string, limit = 200, offset = 0): Promise<StorageRecord[]> {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return [];

    const { data: records, error } = await buildStorageRecordsQuery(supabase, warehouseId, { customerId })
        .order('storage_start_date', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) return [];

    // Use shared mapping helper
    return mapRecords(records);
}

/**
 * Fetches the most recent initial deposits (inflows).
 * 
 * @param {number} [limit=5] - Number of recent inflows to fetch.
 * @returns {Promise<any[]>} Array of recent inflows for dashboard cards.
 */
export const getRecentInflows = cache(async (limit = 5) => {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();
  if (!warehouseId) return [];

  const { data, error } = await supabase
    .from('storage_records')
    .select(`
      id,
      record_number,
      storage_start_date,
      commodity_description,
      bags_in,
      customer:customers ( name, customer_number )
    `)
    .eq('warehouse_id', warehouseId)
    .is('deleted_at', null)
    .order('storage_start_date', { ascending: false })
    .limit(limit);

  if (error) return [];

  return data.map((r: any) => ({
    id: r.id,
    recordNumber: r.record_number,
    date: new Date(r.storage_start_date),
    customerName: r.customer?.name || 'Unknown',
    commodity: r.commodity_description,
    bags: r.bags_in
  }));
});

/**
 * Fetches the most recent withdrawal transactions (outflows).
 * 
 * @param {number} [limit=5] - Number of recent outflows to fetch.
 * @returns {Promise<any[]>} Array of recent outflows for dashboard cards.
 */
export const getRecentOutflows = cache(async (limit = 5) => {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();
  if (!warehouseId) return [];

  const { data, error } = await supabase
    .from('withdrawal_transactions')
    .select(`
      id,
      withdrawal_date,
      bags_withdrawn,
      rent_collected,
      batch_id,
      consolidated_invoice_no,
      storage_record:storage_records (
        id,
        outflow_invoice_no,
        record_number,
        commodity_description,
        bags_stored,
        customer:customers ( name, customer_number )
      )
    `)
    .eq('warehouse_id', warehouseId)
    .is('deleted_at', null)
    .order('withdrawal_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];

  return data.map((r: any) => ({
    id: r.id,
    // Prefer the consolidated invoice number (bulk batch); fall back to
    // per-record outflow invoice for legacy single outflows.
    invoiceNo: r.consolidated_invoice_no || r.storage_record?.outflow_invoice_no || r.storage_record?.record_number || r.storage_record?.id.slice(0,8),
    consolidatedInvoiceNo: r.consolidated_invoice_no || null,
    batchId: r.batch_id || null,
    date: new Date(r.withdrawal_date),
    customerName: r.storage_record?.customer?.name || 'Unknown',
    commodity: r.storage_record?.commodity_description,
    bags: r.bags_withdrawn,
    rentCollected: r.rent_collected || 0,
    maxEditableBags: (r.storage_record?.bags_stored || 0) + r.bags_withdrawn
  }));
});

/**
 * Searches and fetches active storage records specifically for selection in the outflow feature.
 * Performs dynamic calculation of bags stored to prevent using corrupted values.
 * 
 * @param {string} query - The search term (customer name or record number).
 * @param {number} [limit=20] - Max records.
 * @param {number} [offset=0] - Pagination offset.
 * @returns {Promise<any[]>} Array of matching simplified storage records.
 */
export const searchActiveStorageRecords = cache(async (query: string, limit = 20, offset = 0) => {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();
  if (!warehouseId) return [];

  let dbQuery = supabase
    .from('storage_records')
    .select(`
      id,
      record_number,
      storage_start_date,
      commodity_description,
      location,
      bags_stored,
      bags_in,
      customer:customers!inner(name, customer_number),
      withdrawal_transactions (bags_withdrawn, deleted_at) 
    `)
    .eq('warehouse_id', warehouseId)
    .is('deleted_at', null)
    .is('storage_end_date', null)
    .gt('bags_stored', 0) 
    .order('storage_start_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query) {
       if (!isNaN(Number(query))) {
           dbQuery = dbQuery.or(`record_number::text.ilike.%${query}%`);
       } else {
            dbQuery = dbQuery.ilike('customer.name', `%${query}%`);
       }
  }

  const { data, error } = await dbQuery;

  if (error) return [];

  return data.map((r: any) => {
      const totalWithdrawn = (r.withdrawal_transactions || []).filter((wt: any) => !wt.deleted_at).reduce((sum: number, wt: any) => sum + (wt.bags_withdrawn || 0), 0);
      const initialBags = r.bags_in || r.bags_stored || 0;
      const currentBalance = initialBags - totalWithdrawn;

      return {
          id: r.id,
          recordNumber: r.record_number,
          customerName: r.customer?.name,
          commodity: r.commodity_description,
          location: r.location,
          date: new Date(r.storage_start_date),
          bags: currentBalance
      };
  });
});

/**
 * Fetches storage records with advanced filtering, search, pagination and total count metadata.
 * Useful for data tables requiring server-side pagination.
 * 
 * @param {number} [page=1] - Standard 1-indexed page number.
 * @param {number} [limit=20] - Items per page.
 * @param {string} [search] - Keyword to search by customer name or record number.
 * @param {'active' | 'all' | 'released'} [status='active'] - Filtering by record status.
 * @returns {Promise<{ records: StorageRecord[], totalCount: number, totalPages: number }>}
 */
export const getPaginatedStorageRecords = cache(async (
    page: number = 1, 
    limit: number = 20, 
    search?: string,
    status: 'active' | 'all' | 'released' = 'active'
): Promise<{ records: StorageRecord[], totalCount: number, totalPages: number }> => {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    
    if (!warehouseId) return { records: [], totalCount: 0, totalPages: 0 };

    // Common query builder
    const buildQuery = (isSearchByCustomerName = false) => {
        let query = supabase
            .from('storage_records')
            .select(`
                *,
                payments (*),
                customer:customers${isSearchByCustomerName ? '!inner' : ''}(name),
                withdrawal_transactions (bags_withdrawn, deleted_at)
            `, { count: 'exact' })
            .eq('warehouse_id', warehouseId);

        if (status === 'active') {
            query = query.is('storage_end_date', null).is('deleted_at', null);
        } else if (status === 'released') {
            query = query.not('storage_end_date', 'is', null).is('deleted_at', null);
        }
        // If status is 'all', typically we usually want visible records, so filter deleted too.
        if (status === 'all') {
            query = query.is('deleted_at', null);
        }
        return query;
    };

    let query = buildQuery();

    // Filter by Search
    if (search) {
        if (!isNaN(Number(search))) {
             query = query.eq('record_number', search);
        } else {
             // Search by Customer Name
             query = buildQuery(true) // Switch to inner join
                    .ilike('customer.name', `%${search}%`);
        }
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query
        .order('storage_start_date', { ascending: false })
        .range(from, to);

    const { data: records, error, count } = await query;

    if (error) {
        logError(error, { operation: 'fetch_paginated_records', warehouseId });
        return { records: [], totalCount: 0, totalPages: 0 };
    }

    return {
        records: mapRecords(records || []),
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
    };
});
