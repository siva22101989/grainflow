'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

import { getUserWarehouse } from '@/lib/queries';

/**
 * Get SMS settings for current warehouse
 */
export async function getSMSSettings() {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    
    if (!warehouseId) {
        return null;
    }
    
    const { data, error } = await supabase
        .from('sms_settings')
        .select('*')
        .eq('warehouse_id', warehouseId)
        .single();
    
    // Create default settings if none exist
    if (error || !data) {
        const { data: newSettings } = await supabase
            .from('sms_settings')
            .insert({
                warehouse_id: warehouseId,
                enable_sms: false,
                enable_payment_reminders: true,
                enable_inflow_welcome: false,
                enable_outflow_confirmation: false,
                enable_payment_confirmation: false,
            })
            .select()
            .single();
        
        return newSettings;
    }
    
    return data;
}

/**
 * Update SMS settings
 */
export async function updateSMSSettings(settings: {
    enable_sms?: boolean;
    enable_payment_reminders?: boolean;
    enable_inflow_welcome?: boolean;
    enable_outflow_confirmation?: boolean;
    enable_payment_confirmation?: boolean;
}) {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    
    if (!warehouseId) {
        return { success: false, error: 'Warehouse not found' };
    }
    
    const { error } = await supabase
        .from('sms_settings')
        .update({
            ...settings,
            updated_at: new Date().toISOString(),
        })
        .eq('warehouse_id', warehouseId);
    
    if (error) {
        // Handle case where settings row doesn't exist yet
        if (error.code === 'PGRST116' || error.details?.includes('0 rows')) {
             const { error: insertError } = await supabase
                .from('sms_settings')
                .insert({
                    warehouse_id: warehouseId,
                    ...settings,
                });
                
             if (insertError) return { success: false, error: insertError.message };
             revalidatePath('/settings');
             return { success: true };
        }
        return { success: false, error: error.message };
    }
    
    revalidatePath('/settings');
    return { success: true };
}

/**
 * Master SMS switch for the current warehouse. When false, NO SMS should be
 * sent by ANY path (including callers that bypass per-event settings).
 */
export async function isSMSMasterEnabled(): Promise<boolean> {
    const settings = await getSMSSettings();
    return !!settings?.enable_sms;
}

/**
 * Check if a specific SMS type is enabled. The master switch gates everything:
 * if SMS is turned off globally, every type reports disabled.
 */
export async function isSMSEnabled(type: 'payment_reminders' | 'inflow_welcome' | 'outflow_confirmation' | 'payment_confirmation'): Promise<boolean> {
    const settings = await getSMSSettings();

    if (!settings) return false;
    if (!settings.enable_sms) return false; // master switch off → nothing sends

    switch (type) {
        case 'payment_reminders':
            return settings.enable_payment_reminders ?? true;
        case 'inflow_welcome':
            return settings.enable_inflow_welcome ?? false;
        case 'outflow_confirmation':
            return settings.enable_outflow_confirmation ?? false;
        case 'payment_confirmation':
            return settings.enable_payment_confirmation ?? false;
        default:
            return false;
    }
}
