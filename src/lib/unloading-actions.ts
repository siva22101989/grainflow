'use server';

import { createClient } from '@/utils/supabase/server';
import { getUserWarehouse } from '@/lib/queries/warehouses';
import { revalidatePath } from 'next/cache';
import { logError, formatActionError } from './error-logger';

export async function recordUnloading(formData: {
    customerId: string;
    commodityDescription: string;
    cropId?: string;
    bagsUnloaded: number;
    lorryTractorNo?: string;
    notes?: string;
    hamaliAmount?: number;
    destination?: 'storage' | 'plot';
    plotLocation?: string;
}) {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const { data: unloadingRecord, error: unloadingError } = await supabase
            .from('unloading_records')
            .insert({
                warehouse_id: warehouseId,
                customer_id: formData.customerId,
                commodity_description: formData.commodityDescription,
                crop_id: formData.cropId || null,
                bags_unloaded: formData.bagsUnloaded,
                bags_remaining: formData.bagsUnloaded, // Initially all bags are remaining
                lorry_tractor_no: formData.lorryTractorNo || null,
                notes: formData.notes || null,
                hamali_amount: formData.hamaliAmount || 0,
                destination: formData.destination || 'storage',
                plot_location: formData.destination === 'plot' ? formData.plotLocation : null,
                bags_remaining_in_plot: formData.destination === 'plot' ? formData.bagsUnloaded : 0
            })
            .select()
            .single();

        if (unloadingError) throw unloadingError;

        revalidatePath('/inflow');
        revalidatePath('/customers');
        revalidatePath(`/customers/${formData.customerId}`);
        return { success: true, data: unloadingRecord };
    } catch (error: any) {
        logError(error, { operation: 'recordUnloading', metadata: { formData } });
        return { success: false, error: formatActionError(error, 'Failed to record unloading. Please try again.') };
    }
}

export async function getUnloadedInventory() {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) return [];

    const { data, error } = await supabase
        .from('unloading_records')
        .select(`
            *,
            customer:customers(name),
            crop:crops(name)
        `)
        .eq('warehouse_id', warehouseId)
        .gt('bags_remaining', 0)
        .order('unload_date', { ascending: false });

    if (error) {
        logError(error, { operation: 'getUnloadedInventory', metadata: { warehouseId } });
        return [];
    }

    return data;
}

export async function movePlotToStorage(formData: {
    plotLocation: string;
    bagsToMove: number;
    lotId: string;
    customerId: string;
    commodityDescription: string;
    cropId?: string;
}) {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        // 1. Get plot unloading records (FIFO order)
        const { data: plotRecords, error: fetchError } = await supabase
            .from('unloading_records')
            .select('*')
            .eq('warehouse_id', warehouseId)
            .eq('plot_location', formData.plotLocation)
            .eq('destination', 'plot')
            .gt('bags_remaining_in_plot', 0)
            .order('unload_date', { ascending: true });

        if (fetchError) throw fetchError;

        if (!plotRecords || plotRecords.length === 0) {
            return { success: false, error: 'No bags found in this plot location' };
        }

        const totalAvailable = plotRecords.reduce((sum, r) => sum + r.bags_remaining_in_plot, 0);

        if (formData.bagsToMove > totalAvailable) {
            return { 
                success: false, 
                error: `Only ${totalAvailable} bags available in plot. Cannot move ${formData.bagsToMove} bags.` 
            };
        }

        // 2. Create storage record for moved bags
        // 1.1 Calculate Unloading Hamali (FIFO)
        let totalUnloadingHamali = 0;
        let remainingToCalc = formData.bagsToMove;
        
        for (const record of plotRecords) {
            if (remainingToCalc <= 0) break;
            const deduction = Math.min(remainingToCalc, record.bags_remaining_in_plot);
            
            // Calculate proportional hamali cost
            if (record.hamali_amount && record.bags_unloaded > 0) {
                const costPerBag = record.hamali_amount / record.bags_unloaded;
                totalUnloadingHamali += costPerBag * deduction;
            }
            
            remainingToCalc -= deduction;
        }

        // 2. Create storage record for moved bags
        const { data: storageRecord, error: storageError } = await supabase
            .from('storage_records')
            .insert({
                warehouse_id: warehouseId,
                customer_id: formData.customerId,
                commodity_description: formData.commodityDescription,
                crop_id: formData.cropId || null,
                bags_stored: formData.bagsToMove,
                bags_in: formData.bagsToMove,
                lot_id: formData.lotId,
                inflow_type: 'plot',
                storage_start_date: new Date().toISOString(),
                hamali_payable: Math.round(totalUnloadingHamali), // Store as billable amount
                notes: `Moved from Plot. Hamali (Unloading Share): ₹${Math.round(totalUnloadingHamali)}.`,
            })
            .select()
            .single();

        if (storageError) throw storageError;

        // 3. Deduct from plot records (FIFO) — decrement BOTH bags_remaining_in_plot
        // AND bags_remaining (else the unloading record stays visible in unloaded inventory)
        let remaining = formData.bagsToMove;
        for (const record of plotRecords) {
            if (remaining <= 0) break;

            const deduction = Math.min(remaining, record.bags_remaining_in_plot);
            const newRemainingInPlot = record.bags_remaining_in_plot - deduction;
            const newBagsRemaining = Math.max(0, (record.bags_remaining || 0) - deduction);

            await supabase
                .from('unloading_records')
                .update({
                    bags_remaining_in_plot: newRemainingInPlot,
                    bags_remaining: newBagsRemaining,
                    updated_at: new Date().toISOString()
                })
                .eq('id', record.id);

            remaining -= deduction;
        }

        revalidatePath('/inflow');
        revalidatePath('/storage');
        revalidatePath('/customers');
        revalidatePath(`/customers/${formData.customerId}`);
        return { success: true, data: storageRecord };
    } catch (error: any) {
        logError(error, { operation: 'movePlotToStorage', metadata: { formData } });
        return { success: false, error: formatActionError(error, 'Failed to move bags to storage. Please try again.') };
    }
}

export async function getPlotInventory() {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) return [];

    const { data, error } = await supabase
        .from('unloading_records')
        .select(`
            *,
            customer:customers(name),
            crop:crops(name)
        `)
        .eq('warehouse_id', warehouseId)
        .eq('destination', 'plot')
        .gt('bags_remaining_in_plot', 0)
        .order('plot_location')
        .order('unload_date', { ascending: true });

    if (error) {
        logError(error, { operation: 'getPlotInventory', metadata: { warehouseId } });
        return [];
    }

    type PlotGroup = {
        plotLocation: string;
        totalBags: number;
        records: typeof data;
    };

    // Group by plot location
    const grouped = data.reduce<Record<string, PlotGroup>>((acc, record) => {
        const location = record.plot_location;
        if (!location) return acc;

        if (!acc[location]) {
            acc[location] = {
                plotLocation: location,
                totalBags: 0,
                records: []
            };
        }
        acc[location].totalBags += record.bags_remaining_in_plot;
        acc[location].records.push(record);
        return acc;
    }, {});

    return Object.values(grouped);
}

export async function getUnloadingHistory(limit = 20, offset = 0) {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();

    if (!warehouseId) return [];

    const { data, error } = await supabase
        .from('unloading_records')
        .select(`
            *,
            customer:customers(name),
            crop:crops(name),
            lot:warehouse_lots(name),
            storage_record:storage_records(record_number)
        `)
        .eq('warehouse_id', warehouseId)
        .order('unload_date', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        logError(error, { operation: 'getUnloadingHistory', metadata: { warehouseId, limit, offset } });
        return [];
    }

    return data;
}
