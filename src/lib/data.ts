
import { createClient } from '@/utils/supabase/server';
import { cache } from 'react';
import { getAuthUser } from '@/lib/queries/auth';

import type { Customer, StorageRecord, Payment, Expense, ExpenseCategory } from '@/lib/definitions';
import { AuditAction, AuditEntity, UserRole } from '@/types/db';

// Database Row Interfaces
interface DbCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  father_name?: string;
  village?: string;
  created_at?: string;
  updated_at?: string;
  linked_user_id?: string;
}

interface DbPayment {
  amount: number;
  payment_date: string;
  type?: 'rent' | 'hamali' | 'advance' | 'security_deposit' | 'other'; // Updated to DB Enum
  notes?: string;
  updated_at?: string;
}

interface DbStorageRecord {
  id: string;
  record_number?: string;
  customer_id: string;
  crop_id?: string;
  commodity_description: string;
  location: string;
  bags_in?: number;
  bags_stored: number;
  bags_out?: number;
  storage_start_date: string;
  storage_end_date?: string | null;
  billing_cycle?: '6m' | '1y'; // Updated to DB Enum
  hamali_payable: number;
  insurance_payable?: number;
  total_rent_billed: number;
  lorry_tractor_no: string;
  inflow_type?: 'purchase' | 'transfer_in' | 'return' | 'other'; // Updated to DB Enum
  plot_bags?: number;
  load_bags?: number;
  khata_amount?: number;
  outflow_invoice_no?: string;
  notes?: string;
  updated_at?: string;
  payments?: DbPayment[];
  lot_id?: string;
  warehouse_id?: string;
}

interface DbExpense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  category: ExpenseCategory;
  updated_at?: string;
}



import { logError } from '@/lib/error-logger';



/**
 * Retrieves the warehouse ID assigned to the currently authenticated user.
 * Looks up the user's profile in the `profiles` table.
 * 
 * @returns {Promise<string | null>} The warehouse UUID or null if the user is unauthenticated or has no warehouse.
 */
export const getUserWarehouse = cache(async () => {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return null;

  // 1. Try user_metadata (fastest, set during login)
  const metaWarehouseId = user.user_metadata?.warehouse_id;
  if (metaWarehouseId) return metaWarehouseId;

  // 2. Try profiles.warehouse_id (primary assignment)
  const { data: profile } = await supabase
    .from('profiles')
    .select('warehouse_id')
    .eq('id', user.id)
    .single();

  if (profile?.warehouse_id) return profile.warehouse_id;

  // 3. Fallback: Check warehouse_assignments (secondary assignments)
  const { data: assignment } = await supabase
    .from('warehouse_assignments')
    .select('warehouse_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .limit(1)
    .single();

  return assignment?.warehouse_id || null;
});

/**
 * Fetches all available crop types for the current user's warehouse.
 * Used for populating dropdowns and validating entries.
 * 
 * @returns {Promise<any[]>} Array of crop records. Empty array if no warehouse is assigned.
 */
export const getAvailableCrops = cache(async () => {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return [];

    const { data } = await supabase.from('crops').select('*').eq('warehouse_id', warehouseId).order('name');
    return data || [];
});

/**
 * Fetches all active storage lots (locations) for the current user's warehouse.
 * Includes capacity and current stock for each lot.
 * 
 * @returns {Promise<any[]>} Array of warehouse lot records. Empty array if no warehouse is assigned.
 */
export const getAvailableLots = cache(async () => {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return [];

    const { data } = await supabase.from('warehouse_lots').select('*').eq('warehouse_id', warehouseId).is('deleted_at', null).order('name', { ascending: true });
    // Defensive client-side sort in case Supabase order is not applied
    const sorted = (data || []).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    return sorted;
});

/**
 * Retrieves a list of all customers associated with the current user's warehouse.
 * Results are mapped from the database snake_case structure to the application's camelCase Customer type.
 * 
 * @returns {Promise<Customer[]>} Array of Customer objects.
 */
export const customers = cache(async (): Promise<Customer[]> => {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();
  
  if (!warehouseId) return [];

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('warehouse_id', warehouseId);

  if (error) {
    logError(error, { operation: 'fetch_customers', warehouseId });
    return [];
  }

  // Map database fields to application types if needed (snake_case to camelCase)
  // Assuming the DB uses snake_case and app uses camelCase, we might need a mapper or just update definitions.
  // For now, I'll assume we need to map basics.
  return (data as unknown as DbCustomer[]).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email || '',
    address: c.address,
    fatherName: c.father_name || '',
    village: c.village || '',
    updatedAt: c.updated_at ? new Date(c.updated_at) : undefined,
  }));
});

/**
 * Fetches a single customer's details by their ID.
 * 
 * @param {string} id - The UUID of the customer to retrieve.
 * @returns {Promise<Customer | null>} The mapped Customer object, or null if not found or an error occurs.
 */
export const getCustomer = async (id: string): Promise<Customer | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    email: data.email || '',
    address: data.address,
    fatherName: data.father_name || '',
    village: data.village || '',
    updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
  };
};

/**
 * Saves a new customer record to the database or updates an existing one if the ID exists.
 * Associates the customer with the current user's warehouse.
 * 
 * @param {Customer} customer - The customer object containing details to save.
 * @throws {Error} Throws if the user has no assigned warehouse or if the database insertion fails.
 * @returns {Promise<void>}
 */
export const saveCustomer = async (customer: Customer): Promise<void> => {
  'use server';
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();

  if (!warehouseId) throw new Error("No warehouse assigned to user");

  const { error } = await supabase.from('customers').insert({
    // We let Supabase generate ID if it's new, but here we might be passing an ID.
    // If the ID is 'CUST-...', we should probably let Supabase generate a UUID instead.
    // However, to keep compatibility with the app's expecting an ID, we'll strip it if it's a temp one
    // or we just pass the fields.
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    father_name: customer.fatherName,
    village: customer.village,
    warehouse_id: warehouseId,
    linked_user_id: customer.linkedUserId
  });

  if (error) throw error;
};



/**
 * Retrieves all storage records associated with the current user's warehouse.
 * Includes nested payment history for each record. Maps DB columns to the app's camelCase type.
 * 
 * @returns {Promise<StorageRecord[]>} Array of StorageRecord objects with embedded payments.
 */
export const storageRecords = cache(async (): Promise<StorageRecord[]> => {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();
  
  if (!warehouseId) return [];

  // Fetch records with their payments
  const { data: records, error } = await supabase
    .from('storage_records')
    .select(`
      *,
      payments (*)
    `)
    .eq('warehouse_id', warehouseId);

  if (error) {
    logError(error, { operation: 'fetch_storage_records', warehouseId });
    return [];
  }

  return (records as unknown as DbStorageRecord[]).map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    cropId: r.crop_id,
    commodityDescription: r.commodity_description,
    location: r.location,
    bagsIn: r.bags_in || r.bags_stored, // Fallback to bags_stored if bags_in is missing/zero
    bagsOut: r.bags_out || 0,
    bagsStored: r.bags_stored,
    storageStartDate: new Date(r.storage_start_date),
    storageEndDate: r.storage_end_date ? new Date(r.storage_end_date) : null,
    billingCycle: r.billing_cycle as StorageRecord['billingCycle'],
    payments: (r.payments || []).map((p) => ({
      amount: p.amount,
      date: new Date(p.payment_date),
      type: p.type || 'other', 
      notes: p.notes,
      updatedAt: p.updated_at ? new Date(p.updated_at) : undefined
    })),
    hamaliPayable: r.hamali_payable,
    insurancePayable: r.insurance_payable ?? 0,
    totalRentBilled: r.total_rent_billed,
    lorryTractorNo: r.lorry_tractor_no,
    inflowType: r.inflow_type,
    plotBags: r.plot_bags,
    loadBags: r.load_bags,
    khataAmount: r.khata_amount,
    recordNumber: r.record_number,
    outflowInvoiceNo: r.outflow_invoice_no,
    notes: r.notes,
    updatedAt: r.updated_at ? new Date(r.updated_at) : undefined
  }));
});

/**
 * Retrieves a single storage record by its UUID, including its full payment history.
 * 
 * @param {string} id - The UUID of the storage record.
 * @returns {Promise<StorageRecord | null>} The mapped StorageRecord object, or null if not found.
 */
export const getStorageRecord = async (id: string): Promise<StorageRecord | null> => {
  const supabase = await createClient();
  const { data: r, error } = await supabase
    .from('storage_records')
    .select(`
      *,
      payments (*)
    `)
    .eq('id', id)
    .single();

  if (error || !r) return null;

  return {
    id: r.id,
    customerId: r.customer_id,
    cropId: r.crop_id,
    commodityDescription: r.commodity_description,
    location: r.location,
    bagsIn: r.bags_in || r.bags_stored,
    bagsOut: r.bags_out || 0,
    bagsStored: r.bags_stored,
    storageStartDate: new Date(r.storage_start_date),
    storageEndDate: r.storage_end_date ? new Date(r.storage_end_date) : null,
    billingCycle: r.billing_cycle,
    payments: ((r.payments as unknown as DbPayment[]) || []).map((p) => ({
      amount: p.amount,
      date: new Date(p.payment_date),
      type: p.type || 'other',
      notes: p.notes,
      updatedAt: p.updated_at ? new Date(p.updated_at) : undefined
    })),
    hamaliPayable: r.hamali_payable,
    insurancePayable: r.insurance_payable ?? 0,
    totalRentBilled: r.total_rent_billed,
    lorryTractorNo: r.lorry_tractor_no,
    inflowType: r.inflow_type,
    plotBags: r.plot_bags,
    loadBags: r.load_bags,
    khataAmount: r.khata_amount,
    outflowInvoiceNo: r.outflow_invoice_no,
    notes: r.notes,
    updatedAt: r.updated_at ? new Date(r.updated_at) : undefined
  };
};

/**
 * Saves a new initial storage record (inflow).
 * 
 * @param {StorageRecord} record - The initial storage record details.
 * @throws {Error} Throws if the warehouse is missing or the insert operation fails.
 * @returns {Promise<{ id: string }>} An object containing the new UUID of the saved record.
 */
export const saveStorageRecord = async (record: StorageRecord): Promise<{ id: string }> => {
  'use server';
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();

  if (!warehouseId) throw new Error("No warehouse assigned");

  // Prepare database record object (snake_case)
  // Parse 'TEWA-IN-1008' -> 1008
  const recordNumberInt = parseInt(record.id.split('-').pop() || '0', 10);

  const dbRecord: Partial<DbStorageRecord> = {
    // UPDATE: The passed 'id' is actually the Human Readable Record Number.
    // The DB 'id' is a UUID. So we must NOT set 'id' here.
    // The DB 'record_number' is a BIGINT.
    
    // id: record.id,  <-- REMOVED
    record_number: isNaN(recordNumberInt) ? undefined : String(recordNumberInt), // Map numeric part
    
    customer_id: record.customerId,
    commodity_description: record.commodityDescription,
    location: record.location,
    bags_stored: record.bagsStored,
    bags_in: record.bagsIn,
    bags_out: record.bagsOut,
    lorry_tractor_no: record.lorryTractorNo,
    inflow_type: record.inflowType,
    plot_bags: record.plotBags,
    load_bags: record.loadBags,
    khata_amount: record.khataAmount,
    storage_start_date: record.storageStartDate instanceof Date ? record.storageStartDate.toISOString() : record.storageStartDate as string,
    storage_end_date: record.storageEndDate ? (record.storageEndDate instanceof Date ? record.storageEndDate.toISOString() : record.storageEndDate) : undefined,
    billing_cycle: record.billingCycle || '6m',
    hamali_payable: record.hamaliPayable,
    insurance_payable: record.insurancePayable ?? 0,
    total_rent_billed: record.totalRentBilled,
    warehouse_id: warehouseId,
    lot_id: record.lotId,
    crop_id: record.cropId,
    notes: record.notes
  };

  // 1. Insert Storage Record
  const { data: insertedRecord, error: insertError } = await supabase
    .from('storage_records')
    .insert(dbRecord)
    .select()
    .single();

  if (insertError) {
    logError(insertError, { operation: 'insert_storage_record', warehouseId });
    throw insertError; 
  }

  // 2. Insert Payment (if any)
  if (record.payments && record.payments.length > 0) {
    const p = record.payments[0];
    if (p) {
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        storage_record_id: insertedRecord.id,
        amount: p.amount,
        payment_date: p.date,
        type: p.type || 'hamali',
        notes: p.notes
      });

    if (paymentError) {
       logError(paymentError, { operation: 'insert_initial_payment', metadata: { recordId: insertedRecord.id } });
       // Log the error but don't fail the whole operation since the record is saved
    }
    }
  }

  return { id: insertedRecord.id };
};

/**
 * Updates specific fields of an existing storage record.
 * Converts camelCase application fields into snake_case database columns dynamically.
 * 
 * @param {string} id - The UUID of the record to update.
 * @param {Partial<StorageRecord>} data - The fields to update.
 * @throws {Error} Throws if the update fails.
 * @returns {Promise<void>}
 */
export const updateStorageRecord = async (id: string, data: Partial<StorageRecord>): Promise<void> => {
    'use server';
    const supabase = await createClient();
    
    // Map partial data to DB columns
    const dbData: Partial<DbStorageRecord> = {};
    if (data.customerId) dbData.customer_id = data.customerId;
    if (data.cropId) dbData.crop_id = data.cropId;
    if (data.commodityDescription) dbData.commodity_description = data.commodityDescription;
    if (data.location) dbData.location = data.location;
    if (data.bagsStored !== undefined) dbData.bags_stored = data.bagsStored;
    if (data.bagsIn !== undefined) dbData.bags_in = data.bagsIn;
    if (data.bagsOut !== undefined) dbData.bags_out = data.bagsOut;
    if (data.storageStartDate) dbData.storage_start_date = data.storageStartDate instanceof Date ? data.storageStartDate.toISOString() : data.storageStartDate;
    if (data.storageEndDate) dbData.storage_end_date = data.storageEndDate instanceof Date ? data.storageEndDate.toISOString() : data.storageEndDate;
    if (data.billingCycle) dbData.billing_cycle = data.billingCycle;
    if (data.hamaliPayable !== undefined) dbData.hamali_payable = data.hamaliPayable;
    if (data.insurancePayable !== undefined) dbData.insurance_payable = data.insurancePayable;
    if (data.totalRentBilled !== undefined) dbData.total_rent_billed = data.totalRentBilled;
    if (data.plotBags !== undefined) dbData.plot_bags = data.plotBags;
    if (data.loadBags !== undefined) dbData.load_bags = data.loadBags;
    if (data.loadBags !== undefined) dbData.load_bags = data.loadBags;
    if (data.outflowInvoiceNo) dbData.outflow_invoice_no = data.outflowInvoiceNo;
    if (data.notes !== undefined) dbData.notes = data.notes;

    const { error } = await supabase
        .from('storage_records')
        .update(dbData)
        .eq('id', id);

    if (error) throw error;
}



/**
 * Inserts a new payment entry linked to a specific storage record.
 * 
 * @param {string} recordId - The UUID of the storage record.
 * @param {Payment} payment - Payment details (amount, date, type, notes).
 * @throws {Error} Throws if the payment insert fails.
 * @returns {Promise<void>}
 */
export const addPaymentToRecord = async (recordId: string, payment: Payment) => {
    'use server';
    const supabase = await createClient();
    const { error } = await supabase.from('payments').insert({
        storage_record_id: recordId,
        amount: payment.amount,
        payment_date: payment.date,
        type: payment.type || 'other',
        notes: payment.notes
    });
    if (error) throw error;
}



/**
 * Fetches all expenses associated with the current user's warehouse.
 * 
 * @returns {Promise<Expense[]>} Array of Expense objects mapped from the DB.
 */
export const expenses = cache(async (): Promise<Expense[]> => {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();

  if (!warehouseId) return [];

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('warehouse_id', warehouseId);

  if (error) {
    logError(error, { operation: 'fetch_expenses', warehouseId });
    return [];
  }

  return (data as unknown as DbExpense[]).map((e) => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    date: new Date(e.expense_date),
    category: e.category,
    updatedAt: e.updated_at ? new Date(e.updated_at) : undefined
  }));
});

/**
 * Creates a new expense entry in the database.
 * 
 * @param {Expense} expense - The expense details to save.
 * @throws {Error} Throws if warehouse context is missing or if saving fails.
 * @returns {Promise<void>}
 */
export async function saveExpense(expense: Expense): Promise<void> {
  'use server';
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();

  if (!warehouseId) throw new Error("No warehouse assigned");

  const { error } = await supabase.from('expenses').insert({
    description: expense.description,
    amount: expense.amount,
    category: expense.category,
    expense_date: expense.date instanceof Date ? expense.date.toISOString() : expense.date,
    warehouse_id: warehouseId
  });

  if (error) throw error;
}

/**
 * Updates an existing expense entry.
 * 
 * @param {string} id - The UUID of the expense.
 * @param {Partial<Expense>} data - The fields to update.
 * @throws {Error} Throws if the update fails.
 * @returns {Promise<void>}
 */
export const updateExpense = async (id: string, data: Partial<Expense>): Promise<void> => {
    'use server';
    const supabase = await createClient();
    
    // Map partial app type to DB columns
    const dbData: Partial<DbExpense> = {};
    if (data.description) dbData.description = data.description;
    if (data.amount !== undefined) dbData.amount = data.amount;
    if (data.category) dbData.category = data.category;
    if (data.date) dbData.expense_date = data.date instanceof Date ? data.date.toISOString() : data.date;

    const { error } = await supabase
        .from('expenses')
        .update(dbData)
        .eq('id', id);

    if (error) throw error;
};

/**
 * Soft-deletes an expense by setting the `deleted_at` timestamp.
 * 
 * @param {string} id - The UUID of the expense to soft delete.
 * @throws {Error} Throws if the operation fails.
 * @returns {Promise<void>}
 */
export const deleteExpense = async (id: string): Promise<void> => {
    'use server';
    const supabase = await createClient();
    const { error } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
};

/**
 * Soft-deletes a storage record. Highly restricted action.
 * Verifies that the user has either 'owner', 'admin', or 'super_admin' roles
 * in the designated warehouse before allowing deletion.
 * Sets `deleted_at` on both the record and its related `withdrawal_transactions`.
 * 
 * @param {string} id - The UUID of the storage record to soft delete.
 * @throws {Error} Throws if the user lacks permissions or if the DB operation fails.
 * @returns {Promise<void>}
 */
export const deleteStorageRecord = async (id: string): Promise<void> => {
    'use server';
    const supabase = await createClient();
    
    // Fetch record first to release lot (only non-deleted records)
    const { data: record } = await supabase.from('storage_records').select('lot_id, bags_stored, warehouse_id').eq('id', id).is('deleted_at', null).single();
    
    if (!record) return;

    // Security Check: Ensure user is Owner or Admin of the warehouse
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Check if user has warehouse assignment
    const { data: assignment } = await supabase.from('warehouse_assignments')
        .select('warehouse_id')
        .eq('user_id', user.id)
        .eq('warehouse_id', record.warehouse_id)
        .single();
    
    // Fetch profile for role check
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!assignment) {
        throw new Error("You don't have access to this warehouse. Contact your administrator.");
    }

    if (profile?.role !== UserRole.OWNER && profile?.role !== UserRole.ADMIN && profile?.role !== UserRole.SUPER_ADMIN) {
        throw new Error("You don't have permission for this action. Only owners and admins can delete records.");
    }

    // Manual stock update REMOVED.
    // The DB trigger 'sync_lot_stock' now correctly handles soft deletions
    // by excluding records where deleted_at IS NOT NULL.
    // Letting the DB handle this prevents race conditions and double-counting.


    // Soft Delete: Mark as deleted instead of removing
    const now = new Date().toISOString();

    // 1. Soft Delete linked Payments
    const { error: paymentError } = await supabase
        .from('payments')
        .update({ deleted_at: now })
        .eq('storage_record_id', id);

    if (paymentError) {
        logError(paymentError, { operation: 'soft_delete_payments', warehouseId: record.warehouse_id, metadata: { recordId: id } });
        // Continue anyway
    }

    // 2. Soft Delete linked Transactions
    const { error: txError } = await supabase
        .from('withdrawal_transactions')
        .update({ deleted_at: now })
        .eq('storage_record_id', id);

    if (txError) {
        logError(txError, { operation: 'soft_delete_transactions', warehouseId: record.warehouse_id, metadata: { recordId: id } });
    }

    // 3. Mark Storage Record as deleted
    const { error } = await supabase
        .from('storage_records')
        .update({ deleted_at: now })
        .eq('id', id);

    if (error) throw error;

    // AUDIT LOG
    try {
        const { logActivity } = await import('@/lib/audit-service');
        await logActivity({
            action: AuditAction.DELETE,
            entity: AuditEntity.STORAGE_RECORD,
            entityId: id,
            warehouseId: record.warehouse_id,
            details: { reason: 'soft_delete_storage_record' },
            actorUserId: user.id
        });
    } catch (e) {
        // ignore audit failure
    }
};

/**
 * Restores a soft-deleted storage record to an active state.
 * Requires admin and ownership permissions.
 * Also restores related payments and withdrawal transactions.
 * 
 * @param {string} id - The UUID of the storage record to restore.
 * @throws {Error} Throws if unauthorized or operation fails.
 * @returns {Promise<void>}
 */
export const restoreStorageRecord = async (id: string): Promise<void> => {
    'use server';
    const supabase = await createClient();
    
    // Fetch record even if deleted (need to bypass filter if RLS hides it, but normal select finds it if no RLS blocks)
    // Note: If we update 'queries' to filter deleted_at, we can't use 'getStorageRecord' helper. 
    // tailored query:
    const { data: record } = await supabase.from('storage_records').select('lot_id, bags_stored, warehouse_id').eq('id', id).single();
    
    if (!record) return;

    // Security Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Check if user has warehouse assignment
    const { data: assignment } = await supabase.from('warehouse_assignments')
        .select('warehouse_id')
        .eq('user_id', user.id)
        .eq('warehouse_id', record.warehouse_id)
        .single();
    
    // Fetch profile for role check
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!assignment) {
        throw new Error("You don't have access to this warehouse. Contact your administrator.");
    }

    if (profile?.role !== UserRole.OWNER && profile?.role !== UserRole.ADMIN && profile?.role !== UserRole.SUPER_ADMIN) {
        throw new Error("You don't have permission for this action. Only owners and admins can restore records.");
    }

    // Manual stock restoral REMOVED.
    // Trigger 'sync_lot_stock' automatically recalculates when record is updated (restored).

    // 2. Restore linked payments and transactions
    const { error: paymentRestoreError } = await supabase.from('payments').update({ deleted_at: null }).eq('storage_record_id', id);
    if (paymentRestoreError) {
        logError(paymentRestoreError, { operation: 'restoreStorageRecord_payments', metadata: { id } });
        throw new Error("Failed to restore payment records. Please try again.");
    }

    const { error: txRestoreError } = await supabase.from('withdrawal_transactions').update({ deleted_at: null }).eq('storage_record_id', id);
    if (txRestoreError) {
        logError(txRestoreError, { operation: 'restoreStorageRecord_transactions', metadata: { id } });
        throw new Error("Failed to restore withdrawal records. Please try again.");
    }

    // 3. Restore Record
    const { error } = await supabase
        .from('storage_records')
        .update({ deleted_at: null })
        .eq('id', id);

    if (error) throw new Error("Failed to restore storage record. Please try again.");
};

/**
 * Logs a withdrawal transaction and updates stock dynamically via DB triggers.
 * 
 * @param {string} recordId - The UUID of the storage record being withdrawn from.
 * @param {number} bagsWithdrawn - The number of bags taken out.
 * @param {Date | string} date - The date of the withdrawal.
 * @param {number} [rentCollected=0] - The total rent amount collected for this withdrawal.
 * @param {number} [discount=0] - The total discount applied to this rent.
 * @throws {Error} Throws if warehouse ID is missing or DB insert fails.
 * @returns {Promise<string | null>} The UUID of the inserted transaction, or null.
 */
export const saveWithdrawalTransaction = async (
    recordId: string,
    bagsWithdrawn: number,
    date: Date | string,
    rentCollected: number = 0,
    discount: number = 0,
    options?: { batchId?: string; hamaliCharged?: number; insuranceCharged?: number; consolidatedInvoiceNo?: string }
): Promise<string | null> => {
    'use server';
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) throw new Error("No warehouse assigned");

    const insertData: Record<string, any> = {
        storage_record_id: recordId,
        warehouse_id: warehouseId,
        bags_withdrawn: bagsWithdrawn,
        withdrawal_date: date,
        rent_collected: rentCollected,
        discount: discount
    };

    if (options?.batchId) {
        insertData.batch_id = options.batchId;
    }
    if (options?.hamaliCharged !== undefined) {
        insertData.hamali_charged = options.hamaliCharged;
    }
    if (options?.insuranceCharged !== undefined) {
        insertData.insurance_charged = options.insuranceCharged;
    }
    if (options?.consolidatedInvoiceNo) {
        insertData.consolidated_invoice_no = options.consolidatedInvoiceNo;
    }

    const { data, error } = await supabase.from('withdrawal_transactions').insert(insertData).select('id').single();

    if (error) {
        logError(error, { operation: 'save_withdrawal_transaction', warehouseId, metadata: { recordId } });
        throw error;
    }
    
    // AUDIT LOG
    try {
        const { logActivity } = await import('@/lib/audit-service');
        await logActivity({
            action: AuditAction.CREATE,
            entity: AuditEntity.OUTFLOW,
            entityId: data.id,
            warehouseId,
            details: { bagsWithdrawn, rentCollected, recordId, batchId: options?.batchId }
        });
    } catch (e) {
         // ignore
    }

    return data.id;
};
