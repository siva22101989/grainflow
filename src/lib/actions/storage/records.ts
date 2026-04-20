'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import * as Sentry from "@sentry/nextjs";

import { createClient } from '@/utils/supabase/server';
import { getPaginatedStorageRecords, getStorageRecord, searchActiveStorageRecords, getUserWarehouse, getStorageRecords } from '@/lib/queries';
import { updateStorageRecord, deleteStorageRecord, restoreStorageRecord } from '@/lib/data';
import { detectStorageAnomalies as detectStorageAnomaliesFlow } from '@/ai/flows/anomaly-detection';
import { logError, formatActionError } from '@/lib/error-logger';
import { FormState } from '../common';
import type { StorageRecord } from '@/lib/definitions';

const { logger } = Sentry;

export async function findRecordsAction(query: string) {
    return await searchActiveStorageRecords(query);
}

export async function fetchStorageRecordsAction(
  page: number = 1, 
  limit: number = 20, 
  search?: string, 
  status: 'active' | 'all' | 'released' = 'active'
) {
    return await getPaginatedStorageRecords(page, limit, search, status);
}

export async function getStorageRecordAction(id: string) {
    return await getStorageRecord(id);
}

export async function getAnomalyDetection() {
  return Sentry.startSpan(
    {
      op: "function",
      name: "getAnomalyDetection",
    },
    async () => {
      try {
        const records = await getStorageRecords();
        const result = await detectStorageAnomaliesFlow({ storageRecords: JSON.stringify(records) });
        logger.info("Anomaly detection completed", { count: result.anomalies.length });
        return { success: true, anomalies: result.anomalies };
      } catch (error: any) {
        logError(error, { operation: 'getAnomalyDetection' });
        return { success: false, anomalies: 'An error occurred while analyzing records.' };
      }
    }
  );
}

const StorageRecordUpdateSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(2, 'Commodity description is required.'),
  location: z.string().min(1, 'Location is required.'),
  bagsStored: z.coerce.number().int().positive('Bags must be a positive number.'),
  hamaliPayable: z.coerce.number().nonnegative('Hamali charges must be a non-negative number.'),
  storageStartDate: z.string().refine(val => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date <= new Date();
  }, { message: "Date cannot be in the future" }),
  cropId: z.string().optional(),
});

export async function updateStorageRecordAction(recordId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
    const rawData = {
        customerId: formData.get('customerId'),
        commodityDescription: formData.get('commodityDescription'),
        location: formData.get('location'),
        bagsStored: formData.get('bagsStored'),
        hamaliPayable: formData.get('hamaliPayable'),
        storageStartDate: formData.get('storageStartDate'),
        cropId: formData.get('cropId'),
    };

    const validatedFields = StorageRecordUpdateSchema.safeParse(rawData);

    if (!validatedFields.success) {
        const error = validatedFields.error.flatten().fieldErrors;
        const message = Object.values(error).flat().join(', ');
        return { message: `Invalid data: ${message}`, success: false, data: rawData };
    }
    
    const originalRecord = await getStorageRecord(recordId);
    if (!originalRecord) {
        return { message: 'Record not found.', success: false, data: rawData };
    }

    const { bagsStored, ...rest } = validatedFields.data;

    const dataToUpdate: Partial<StorageRecord> = {
        ...rest,
        bagsIn: bagsStored,
        bagsStored: bagsStored - (originalRecord.bagsOut || 0), // Recalculate balance
        storageStartDate: new Date(validatedFields.data.storageStartDate)
    };

    // Capacity Check
    if (originalRecord.lotId && bagsStored > (originalRecord.bagsStored || 0)) {
         const supabase = await createClient();
         const { data: lot } = await supabase
            .from('warehouse_lots')
            .select('capacity, current_stock, name')
            .eq('id', originalRecord.lotId)
            .single();
         
          if (lot) {
            const capacity = lot.capacity || 1000;
            const currentStock = lot.current_stock || 0;
            // Balance check: We are changing bagsStored (which is bagsIn/stored). 
            // Logic: currentStock - oldBags + newBags
            // Note: originalRecord.bagsIn might be the reference for 'original contribution to stock'. 
            // bagsStored is the *current* balance (after outflows).
            // Usually Inflows add to Stock. Outflows remove.
            // Editing a record generally updates the *Inflow* amount (bagsIn).
            // So we should compare bagsIn.
            // validatedFields has bagsStored which maps to bagsIn (line 95).
            
            const oldContribution = originalRecord.bagsIn || 0;
            const newContribution = bagsStored;
            const projectedStock = currentStock - oldContribution + newContribution;

            if (projectedStock > capacity) {
                 return { 
                    message: `Lot ${lot.name} capacity exceeded! Capacity: ${capacity}, Projected: ${projectedStock}`, 
                    success: false, 
                    data: rawData 
                };
            }
          }
    }

    try {
        await updateStorageRecord(recordId, dataToUpdate);
    } catch (error: any) {
        logError(error, { operation: 'updateStorageRecordAction', metadata: { recordId } });
        return { message: `Failed to update record: ${error.message}`, success: false, data: rawData };
    }

    revalidatePath('/storage');
    revalidatePath('/payments/pending');
    revalidatePath('/reports');
    revalidatePath('/customers');
    revalidatePath('/financials');
    if (originalRecord.customerId) {
        revalidatePath(`/customers/${originalRecord.customerId}`);
    }
    return { message: 'Record updated successfully.', success: true };
}

/**
 * Simple Storage Record Update (for UI)
 */
export async function updateStorageRecordSimple(recordId: string, formData: {
    commodityDescription: string;
    location: string;
    bagsStored: number;
    hamaliPayable: number;
    storageStartDate: string;
    // Extended fields for Admin
    customerId?: string;
    cropId?: string;
    lotId?: string;
    lorryTractorNo?: string;
    inflowType?: 'purchase' | 'transfer_in' | 'return' | 'other';
}) {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) {
        return { message: 'No warehouse found for user', success: false };
    }

    // Validation Logic
    if (formData.bagsStored <= 0) return { message: 'Bags must be positive', success: false };
    if (formData.hamaliPayable < 0) return { message: 'Hamali cannot be negative', success: false };
    const startDate = new Date(formData.storageStartDate);
    if (isNaN(startDate.getTime()) || startDate > new Date()) return { message: 'Invalid or future start date', success: false };


    // Check if record is completed & Get details for Capacity Check
    const { data: record, error: fetchError } = await supabase
        .from('storage_records')
        .select('storage_end_date, customer_id, lot_id, bags_stored, bags_out, crop_id')
        .eq('id', recordId)
        .single();

    if (fetchError || !record) return { message: 'Record not found', success: false };

    if (record.storage_end_date) {
        return { message: 'Cannot edit completed records', success: false };
    }

    // Capacity Check
    const targetLotId = formData.lotId || record.lot_id;
    if (targetLotId) {
        const { data: lot } = await supabase
            .from('warehouse_lots')
            .select('capacity, current_stock, name')
            .eq('id', targetLotId)
            .single();

        if (lot) {
            const capacity = lot.capacity || 1000;
            const currentStock = lot.current_stock || 0;
            
            // Calculate impact
            let projectedStock = currentStock;
            
            if (targetLotId === record.lot_id) {
                // Same lot: Remove old bags, add new bags
                projectedStock = currentStock - (record.bags_stored || 0) + formData.bagsStored;
            } else {
                // New lot: Just add new bags (Old lot stock will be reduced by trigger/update logic elsewhere?)
                // Actually, if we change lots, we need to ensure the NEW lot has space.
                // The current stock of the NEW lot includes its current records.
                projectedStock = currentStock + formData.bagsStored;
            }

            if (projectedStock > capacity) {
                 return { 
                    message: `Lot ${lot.name} capacity exceeded! Capacity: ${capacity}, Projected: ${projectedStock}`, 
                    success: false 
                };
            }
        }
    }

    // Auto-populate from IDs if descriptions are missing
    let finalCommodityDescription = formData.commodityDescription;
    let finalLocation = formData.location;

    // Fetch details if we need to fill in missing data OR for capacity check
    const targetCropId = formData.cropId || record?.crop_id;
    // targetLotId is already defined above at line 197, reused here.
    
    // Only fetch if we are actually missing data
    const needsCropName = !finalCommodityDescription && targetCropId;
    const needsLotName = !finalLocation && targetLotId;

    if (needsCropName || needsLotName) {
         if (needsCropName) {
            const { data: crop } = await supabase.from('crops').select('name').eq('id', targetCropId).single();
            if (crop) finalCommodityDescription = crop.name;
         }
         // Note: Lot name might be fetched below in capacity check too, optimization possible but keeping simple for now
         if (needsLotName) {
             const { data: lot } = await supabase.from('warehouse_lots').select('name').eq('id', targetLotId).single();
             if (lot) finalLocation = lot.name;
         }
    }

    // Transform to database column names
    // Transform to database column names
    const updateData: any = {
        commodity_description: finalCommodityDescription,
        location: finalLocation,
        bags_in: formData.bagsStored,
        bags_stored: formData.bagsStored - (record.bags_out || 0),
        hamali_payable: formData.hamaliPayable,
        storage_start_date: new Date(formData.storageStartDate),
    };

    // Add extended fields if present
    if (formData.customerId) updateData.customer_id = formData.customerId;
    if (formData.cropId) updateData.crop_id = formData.cropId;
    if (formData.lotId) updateData.lot_id = formData.lotId;
    if (formData.lorryTractorNo !== undefined) updateData.lorry_tractor_no = formData.lorryTractorNo; // Allow clearing
    if (formData.inflowType) updateData.inflow_type = formData.inflowType;

    const { error } = await supabase
        .from('storage_records')
        .update(updateData)
        .eq('id', recordId)
        .eq('warehouse_id', warehouseId);

    if (error) {
        logError(error, { operation: 'update_storage_record', warehouseId, metadata: { recordId } });
        return { message: `Failed to update record: ${error.message}`, success: false };
    }

    revalidatePath('/storage');
    revalidatePath('/payments/pending');
    revalidatePath('/reports');
    revalidatePath('/customers');
    revalidatePath('/financials');
    if (formData.customerId) {
        revalidatePath(`/customers/${formData.customerId}`);
    } else if (record?.customer_id) {
         revalidatePath(`/customers/${record.customer_id}`);
    }
    return { message: 'Record updated successfully!', success: true };
}

export async function deleteStorageRecordAction(recordId: string): Promise<FormState> {
  try {
    await deleteStorageRecord(recordId);
    revalidatePath('/reports');
    revalidatePath('/storage');
    revalidatePath('/payments/pending');
    return { message: 'Record deleted successfully.', success: true };
  } catch (error: any) {
    logError(error, { operation: 'deleteStorageRecordAction', metadata: { recordId } });
    return { message: formatActionError(error, 'Failed to delete record.'), success: false };
  }
}

export async function restoreStorageRecordAction(recordId: string): Promise<FormState> {
  try {
    await restoreStorageRecord(recordId);
    revalidatePath('/reports');
    revalidatePath('/storage');
    revalidatePath('/payments/pending');
    return { message: 'Record restored successfully.', success: true };
  } catch (error: any) {
    logError(error, { operation: 'restoreStorageRecordAction', metadata: { recordId } });
    return { message: formatActionError(error, 'Failed to restore record.'), success: false };
  }
}

export async function getCustomerRecordsAction(customerId: string) {
    const { getStorageRecords } = await import('@/lib/queries');
    const allRecords = await getStorageRecords();
    return allRecords.filter(r => r.customerId === customerId);
}
