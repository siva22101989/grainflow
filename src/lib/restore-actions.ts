'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { getUserWarehouse } from '@/lib/queries';
import { logError } from './error-logger';
import { UserRole } from '@/types/db';

export async function restoreFromBackup(backupData: any) {
  const supabase = await createClient();
  
  // 1. Identification
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Unauthorized' };
  }

  // Role Check
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== UserRole.OWNER && profile?.role !== UserRole.SUPER_ADMIN) {
      return { success: false, message: 'Permission Denied: Only Owners and Super Admins can restore data.' };
  }
  const targetWarehouseId = await getUserWarehouse();
  if (!targetWarehouseId) {
      return { success: false, message: 'No target warehouse found. Please log in.' };
  }
  
  // Helper to re-map ID
  const mapData = (items: any[]) => {
      if (!items || !Array.isArray(items)) return [];
      return items.map(item => ({
          ...item,
          warehouse_id: targetWarehouseId // FORCE override to current warehouse
      }));
  };

  try {
    const results = {
      warehouse: false,
      sequences: 0,
      customers: 0,
      storage_records: 0,
      withdrawal_transactions: 0,
      payments: 0,
      expenses: 0,
      crops: 0,
      lots: 0,
      errors: [] as string[]
    };

    // 2. Restore Warehouse Metadata (Name, Location, etc)
    if (backupData.warehouse && typeof backupData.warehouse === 'object') {
        const { id, created_at, ...updates } = backupData.warehouse;
        // Verify we only update safe fields
        const safeUpdates = {
            name: updates.name,
            location: updates.location,
            capacity_bags: updates.capacity_bags,
            phone: updates.phone,
            email: updates.email
        };
        
        const { error } = await supabase.from('warehouses').update(safeUpdates).eq('id', targetWarehouseId);
        if (error) results.errors.push(`Warehouse Meta: ${error.message}`);
        else results.warehouse = true;
    }
    
    // 3. Static Data
    // Note: We use upsert. If importing from different ID, original IDs are preserved but warehouse_id changes.
    // If ID collisions occur with existing data in THIS warehouse, they will update.
    
    if (backupData.crops?.length) {
        const { error } = await supabase.from('crops').upsert(mapData(backupData.crops), { onConflict: 'id', ignoreDuplicates: true });
        if (error) results.errors.push(`Crops: ${error.message}`);
        else results.crops = backupData.crops.length;
    }
    
    if (backupData.lots?.length) {
        const { error } = await supabase.from('warehouse_lots').upsert(mapData(backupData.lots), { onConflict: 'id', ignoreDuplicates: true });
        if (error) results.errors.push(`Lots: ${error.message}`);
        else results.lots = backupData.lots.length;
    }

    // 4. Customers
    if (backupData.customers?.length) {
      const { error } = await supabase.from('customers').upsert(mapData(backupData.customers), { onConflict: 'id', ignoreDuplicates: true });
      if (error) results.errors.push(`Customers: ${error.message}`);
      else results.customers = backupData.customers.length;
    }

    // 5. Storage Records
    if (backupData.storage_records?.length) {
      const { error } = await supabase.from('storage_records').upsert(mapData(backupData.storage_records), { onConflict: 'id', ignoreDuplicates: true });
      if (error) results.errors.push(`Storage Records: ${error.message}`);
      else results.storage_records = backupData.storage_records.length;
    }

    // 6. Withdrawal Transactions
    if (backupData.withdrawal_transactions?.length) {
      const { error } = await supabase.from('withdrawal_transactions').upsert(mapData(backupData.withdrawal_transactions), { onConflict: 'id', ignoreDuplicates: true });
      if (error) results.errors.push(`Withdrawals: ${error.message}`);
      else results.withdrawal_transactions = backupData.withdrawal_transactions.length;
    }

    // 7. Payments (Wait, payments table usually links via storage_record_id, doesn't always have warehouse_id column directly? Check schema)
    // Schema check: Payments table DOES NOT have warehouse_id. It links to storage_records.
    // So mapData is NOT needed for payments, raw import is fine as long as storage_record_ids exist.
    if (backupData.payments?.length) {
      const { error } = await supabase.from('payments').upsert(backupData.payments, { onConflict: 'id', ignoreDuplicates: true });
      if (error) results.errors.push(`Payments: ${error.message}`);
      else results.payments = backupData.payments.length;
    }

    // 8. Expenses
    if (backupData.expenses?.length) {
      const { error } = await supabase.from('expenses').upsert(mapData(backupData.expenses), { onConflict: 'id', ignoreDuplicates: true });
      if (error) results.errors.push(`Expenses: ${error.message}`);
      else results.expenses = backupData.expenses.length;
    }
    
    // 9. Sequences (Invoice numbering)
    if (backupData.sequences?.length) {
        // Sequences are (warehouse_id, type) PK.
        // We need to map warehouse_id here too.
        const mappedSequences = mapData(backupData.sequences);
        const { error } = await supabase.from('sequences').upsert(mappedSequences, { onConflict: 'warehouse_id, type', ignoreDuplicates: false }); 
        // We allow overwrite here to sync invoice numbers
        if (error) results.errors.push(`Sequences: ${error.message}`);
        else results.sequences = backupData.sequences.length;
    }

    if (results.errors.length > 0) {
        logError(new Error("Restore partial failure"), { 
            operation: 'restoreFromBackup', 
            metadata: { errors: results.errors, details: results } 
        });
        return { success: false, message: `Partial Restore. Errors: ${results.errors.join(', ')}`, details: results };
    }

    revalidatePath('/', 'layout');
    return { success: true, message: 'Restore executed successfully.', details: results };

  } catch (error: any) {
    logError(error, { operation: 'restoreFromBackup_fatal' });
    return { success: false, message: `Fatal Error: ${error.message}` };
  }
}
