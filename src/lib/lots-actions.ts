'use server';

import { createClient } from '@/utils/supabase/server';
import { getUserWarehouse } from "@/lib/queries";
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/error-logger';
import { validatePricingSlabs } from '@/lib/billing';

export async function addLot(formData: FormData) {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();
  
  if (!warehouseId) throw new Error('Unauthorized');

  const name = formData.get('name') as string;
  const capacityStr = formData.get('capacity') as string;
  const capacity = capacityStr ? parseInt(capacityStr) : 1000;

  const { error } = await supabase.from('warehouse_lots').insert({
    warehouse_id: warehouseId,
    name,
    capacity,
    status: 'Active'
  });

  if (error) {
    logError(error, { operation: 'addLot', metadata: { warehouseId, name } });
    throw new Error('Failed to add lot');
  }
  revalidatePath('/settings/lots');
}

export async function bulkAddLots(formData: FormData) {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    
    if (!warehouseId) throw new Error('Unauthorized');
  
    const prefix = formData.get('prefix') as string;
    const start = parseInt(formData.get('start') as string);
    const end = parseInt(formData.get('end') as string);
    const capacityStr = formData.get('capacity') as string;
    const capacity = capacityStr ? parseInt(capacityStr) : 1000;
  
    if (isNaN(start) || isNaN(end) || start > end) {
        throw new Error('Invalid range');
    }

    const lots = [];
    for (let i = start; i <= end; i++) {
        lots.push({
            warehouse_id: warehouseId,
            name: `${prefix}${i}`,
            capacity,
            status: 'Active'
        });
    }

    const { error } = await supabase.from('warehouse_lots').insert(lots);
  
    if (error) {
        logError(error, { operation: 'bulkAddLots', metadata: { warehouseId } });
        throw new Error('Failed to bulk add lots');
    }
  
    revalidatePath('/settings/lots');
}

export async function deleteLot(id: string) {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) throw new Error('Unauthorized');

    const { error } = await supabase
        .from('warehouse_lots')
        .update({ 
            deleted_at: new Date().toISOString(),
            name: `${id.slice(0, 8)}_del_${Date.now()}` // Rename to free up the unique name
        })
        .eq('id', id)
        .eq('warehouse_id', warehouseId);
    if (error) {
        logError(error, { operation: 'deleteLot', metadata: { id } });
        throw new Error('Failed to delete lot');
    }
    revalidatePath('/settings/lots');
}

export async function addLotsFromList(formData: FormData) {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) throw new Error('Unauthorized');
  
    const listContent = formData.get('list_content') as string;
    const capacityStr = formData.get('capacity') as string;
    const capacity = capacityStr ? parseInt(capacityStr) : 1000;
  
    if (!listContent) return;

    // Split by comma or newline, trim, and filter empty
    const names = listContent.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    
    // Deduplicate names within the input
    const uniqueNames = Array.from(new Set(names));

    if (uniqueNames.length === 0) return;

    const lots = uniqueNames.map(name => ({
        warehouse_id: warehouseId,
        name,
        capacity,
        status: 'Active'
    }));

    const { error } = await supabase.from('warehouse_lots').insert(lots);
  
    if (error) {
        logError(error, { operation: 'addLotsFromList', metadata: { warehouseId } });
        throw new Error('Failed to add lots from list');
    }
  
    revalidatePath('/settings/lots');
}

/**
 * Update Lot
 */
export async function updateLot(lotId: string, formData: FormData) {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();

  if (!warehouseId) throw new Error('Unauthorized');

  const name = formData.get('name') as string;
  const capacity = parseInt(formData.get('capacity') as string);

  if (!name || !capacity || capacity <= 0) {
    throw new Error('Invalid lot data');
  }

  const { error } = await supabase
    .from('warehouse_lots')
    .update({ name, capacity })
    .eq('id', lotId)
    .eq('warehouse_id', warehouseId);

  if (error) {
    logError(error, { operation: 'updateLot', metadata: { lotId } });
    throw new Error('Failed to update lot');
  }

  revalidatePath('/settings/lots');
}

/**
 * Update Crop
 */
export async function updateCrop(cropId: string, formData: FormData) {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();

  if (!warehouseId) throw new Error('Unauthorized');

  const name = formData.get('name') as string;
  const rentPrice6m = parseFloat(formData.get('price6m') as string);
  const rentPrice1y = parseFloat(formData.get('price1y') as string);

  if (!name || isNaN(rentPrice6m) || isNaN(rentPrice1y)) {
    throw new Error('Invalid crop data');
  }

  // Parse optional pricing slabs
  const pricingSlabsRaw = formData.get('pricingSlabs') as string | null;
  let pricingSlabs: any = null;
  if (pricingSlabsRaw) {
    try {
      pricingSlabs = JSON.parse(pricingSlabsRaw);
    } catch {
      throw new Error('Invalid pricing slab JSON');
    }
    const validationError = validatePricingSlabs(pricingSlabs);
    if (validationError) {
      throw new Error(validationError);
    }
  }

  const { error } = await supabase
    .from('crops')
    .update({
        name,
        rent_price_6m: rentPrice6m,
        rent_price_1y: rentPrice1y,
        pricing_slabs: pricingSlabs
    })
    .eq('id', cropId)
    .eq('warehouse_id', warehouseId);

  if (error) {
    logError(error, { operation: 'updateCrop', metadata: { cropId } });
    throw new Error('Failed to update crop');
  }

  revalidatePath('/settings');
  revalidatePath('/settings/lots');
}

/**
 * Delete Crop
 */
export async function deleteCrop(cropId: string) {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();

  if (!warehouseId) throw new Error('Unauthorized');

  // Check if crop is being used in any storage records
  const { data: records } = await supabase
    .from('storage_records')
    .select('id')
    .eq('crop_id', cropId)
    .limit(1);

  if (records && records.length > 0) {
    throw new Error('Cannot delete crop that is being used in storage records');
  }

  const { error } = await supabase
    .from('crops')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', cropId)
    .eq('warehouse_id', warehouseId);

  if (error) {
    logError(error, { operation: 'deleteCrop', metadata: { cropId } });
    throw new Error('Failed to delete crop');
  }

  revalidatePath('/settings/lots');
}
