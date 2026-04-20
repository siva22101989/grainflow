'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

const CROPS_DATA = [
    { name: 'Paddy - Common', rent_price_6m: 20, rent_price_1y: 35 },
    { name: 'Maize - Hybrid', rent_price_6m: 18, rent_price_1y: 30 },
    { name: 'Groundnut - Pods', rent_price_6m: 25, rent_price_1y: 45 },
    { name: 'Chilli - Dry', rent_price_6m: 30, rent_price_1y: 55 },
    { name: 'Cotton - Bales', rent_price_6m: 50, rent_price_1y: 90 }
];

const LOT_PREFIXES = ['A', 'B', 'C', 'D', 'E'];

// Helper to generate random date within last N months
function getRandomDate(monthsBack: number) {
    const date = new Date();
    date.setMonth(date.getMonth() - Math.floor(Math.random() * monthsBack));
    date.setDate(Math.floor(Math.random() * 28) + 1);
    return date;
}

export async function resetAndSeedDatabase(options?: { skipSeeding?: boolean }) {
    console.log('Starting Database Reset...');
    const supabase = await createClient();

    // 1. Fetch Warehouses and Profiles to link users
    const { data: warehouses, error: whError } = await supabase.from('warehouses').select('id');
    const { data: profiles } = await supabase.from('profiles').select('id, warehouse_id');
    
    // Map Warehouse ID to User ID (Owner)
    const warehouseOwners: Record<string, string> = {};
    if (profiles) {
        profiles.forEach(p => {
            if (p.warehouse_id) warehouseOwners[p.warehouse_id] = p.id;
        });
    }

    if (whError || !warehouses || warehouses.length === 0) {
        return { message: 'No warehouses found to seed data into.', success: false };
    }

    // 2. Clear Tables (Order is critical for Foreign Keys)
    const tables = [
        'notifications',
        'payments', 
        'storage_records', 
        'expenses',
        'customers',
        'warehouse_lots',
        'crops'
    ];

    for (const table of tables) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        if (error) {
            console.error(`Error clearing ${table}:`, error);
        }
    }

    // Clear sequences explicitly (no ID column)
    const { error: seqError } = await supabase.from('sequences').delete().neq('warehouse_id', '00000000-0000-0000-0000-000000000000');
    if (seqError) console.error('Error clearing sequences:', seqError);

    if (options?.skipSeeding) {
        revalidatePath('/');
        return { message: 'Database flushed successfully. Users and Warehouses preserved.', success: true };
    }

    console.log('Tables cleared. Starting Seed...');

    // 3. Seed Data Per Warehouse
    let totalCustomers = 0;
    let totalRecords = 0;

    for (const wh of warehouses) {
        const warehouseId = wh.id;
        const ownerUserId = warehouseOwners[warehouseId];

        // A. Create Crops
        const createdCrops = [];
        for (const crop of CROPS_DATA) {
            const { data } = await supabase.from('crops').insert({
                ...crop,
                warehouse_id: warehouseId,
                id: crypto.randomUUID()
            }).select().single();
            if (data) createdCrops.push(data);
        }

        // B. Create Lots (5 Lots, 1500 Capacity)
        const createdLots = [];
        for (let i = 0; i < 5; i++) {
            const { data } = await supabase.from('warehouse_lots').insert({
                warehouse_id: warehouseId,
                name: `Lot ${LOT_PREFIXES[i]}`,
                capacity: 1500,
                current_stock: 0, 
                status: 'Available',
                id: crypto.randomUUID()
            }).select().single();
            if (data) createdLots.push(data);
        }

        // C. Create Customers (20)
        const createdCustomers = [];
        for (let i = 1; i <= 20; i++) {
            // Link 25% of customers to the warehouse owner (Simulate Portal Users)
            const shouldLinkUser = ownerUserId && Math.random() < 0.25; 
            
            // Just for variety
            const villageName = `Village ${String.fromCharCode(65 + (i % 5))}`;

            const { data } = await supabase.from('customers').insert({
                warehouse_id: warehouseId,
                name: `Customer ${i}`,
                phone: `9${Math.floor(Math.random() * 1000000000)}`,
                village: villageName,
                father_name: `Father ${i}`,
                address: `Address ${i}, ${villageName}`,
                linked_user_id: shouldLinkUser ? ownerUserId : null,
                id: crypto.randomUUID()
            }).select().single();
            if (data) createdCustomers.push(data);
        }

        // D. Create Storage Records (50)
        // We need to carefully track lot capacity if we don't want constraints to fail, 
        // but for seeding we can just distribute them.
        
        // Simulating 50 records
        for (let i = 1; i <= 50; i++) {
            const customer = createdCustomers[Math.floor(Math.random() * createdCustomers.length)];
            const crop = createdCrops[Math.floor(Math.random() * createdCrops.length)];
            const lot = createdLots[Math.floor(Math.random() * createdLots.length)];

            if (!customer || !crop || !lot) continue;

            // Random bags between 10 and 100
            const bags = Math.floor(Math.random() * 90) + 10;
            const isCompleted = Math.random() > 0.7; // 30% completed
            
            const startDate = getRandomDate(6);
            const endDate = isCompleted ? new Date(startDate.getTime() + (Math.random() * 90 * 24 * 60 * 60 * 1000)) : null;

            // Use the NEW invoice numbering utility? 
            // Ideally we should use the utility, but for seeding massive data, calling RPC one by one is slow.
            // But if we don't, the sequence table won't update!
            // So we MUST use the sequence utility or sequences table.
            
            // However, the previous seed logic used `SEED-WH-ID`.
            // Let's stick to the previous seed logic for IDs for now, OR update it to use sequences?
            // User just asked to "remove the flush data once more but dont insert seed data".
            // So I should focus on the FLUSH part, not changing the seed logic significantly right now.
            // I'll keep the seed logic as is for now, even though it bypasses the sequence.
            // If they click "Flush Only", they will manually create records which WILL use the sequence.
            
            const recordId = `SEED-${warehouseId.substring(0,3)}-${i}`;
            
            const hamaliRate = 12; // Example
            const hamaliPayable = bags * hamaliRate;

             // Create Record
            const { error } = await supabase.from('storage_records').insert({
                id: recordId,
                warehouse_id: warehouseId,
                customer_id: customer.id,
                lot_id: lot.id,
                crop_id: crop.id,
                bags_stored: isCompleted ? 0 : bags,
                storage_start_date: startDate,
                storage_end_date: endDate,
                commodity_description: crop.name,
                location: lot.name,
                hamali_payable: hamaliPayable,
                total_rent_billed: isCompleted ? (bags * crop.rent_price_6m) : 0,
                // billing_cycle is the DB enum '6m' | '1y' (record completion is tracked via storage_end_date)
                billing_cycle: '6m',
                // inflow_type DB enum: 'purchase' | 'transfer_in' | 'return' | 'other'
                inflow_type: 'purchase'
            });

            if (error) {
                console.error(`Error creating record ${i}:`, error);
                continue;
            }

            // Create Random Payment (50% chance)
            if (Math.random() > 0.5) {
                await supabase.from('payments').insert({
                    warehouse_id: warehouseId,
                    storage_record_id: recordId,
                    customer_id: customer.id,
                    amount: Math.floor(Math.random() * 2000) + 500,
                    payment_date: isCompleted ? endDate : startDate, // Pay on exit or entry
                    type: 'other',
                    notes: 'Advance / Settlement'
                });
            }
            
             // Update Lot Stock (Simple increment, ignoring verifying capacity strictness here)
            if (!isCompleted) {
                 const { data: currentLot } = await supabase.from('warehouse_lots').select('current_stock').eq('id', lot.id).single();
                 if (currentLot) {
                     await supabase.from('warehouse_lots').update({ 
                         current_stock: (currentLot.current_stock || 0) + bags 
                     }).eq('id', lot.id);
                 }
            }
        }
        
        totalCustomers += createdCustomers.length;
        totalRecords += 50;
    }

    revalidatePath('/');
    return { 
        message: `Database Reset & Seed Complete! 
        Warehouses: ${warehouses.length}, 
        Customers: ${totalCustomers}, 
        Records: ${totalRecords} (approx)`, 
        success: true 
    };
}
