import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserWarehouse } from '@/lib/queries/warehouses';
import { logError } from '@/lib/error-logger';

export async function GET() {
    try {
        const supabase = await createClient();
        const warehouseId = await getUserWarehouse();

        if (!warehouseId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        logError(error, { operation: 'api.unloadingRecords.get' });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
