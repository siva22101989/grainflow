/**
 * Daily cron: nudge warehouses about Plot inflow records that have been
 * sitting in drying (load_bags not finalized) for more than 7 days.
 *
 * For each warehouse with stale drying records, inserts ONE warehouse-scoped
 * notification summarizing the count + oldest record. Owners see this in their
 * notification bell when they next open the app.
 *
 * Schedule: daily at 8:00 AM IST (02:30 UTC).
 */

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const STALE_DAYS = 7;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = await createClient();
  const cutoffISO = new Date(Date.now() - STALE_MS).toISOString();

  // All Plot inflow records still pending finalization, older than cutoff.
  const { data: stale, error } = await supabase
    .from('storage_records')
    .select('id, record_number, warehouse_id, customer_id, plot_bags, storage_start_date, customers(name)')
    .eq('inflow_type', 'transfer_in')
    .is('storage_end_date', null)
    .is('deleted_at', null)
    .or('load_bags.is.null,load_bags.eq.0')
    .lt('storage_start_date', cutoffISO);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  if (!stale || stale.length === 0) {
    return NextResponse.json({ success: true, warehouses_notified: 0, stale_records: 0 });
  }

  // Group by warehouse_id
  const byWarehouse = new Map<string, typeof stale>();
  for (const r of stale) {
    const list = byWarehouse.get(r.warehouse_id) ?? [];
    list.push(r);
    byWarehouse.set(r.warehouse_id, list);
  }

  let warehousesNotified = 0;
  for (const [warehouseId, records] of byWarehouse.entries()) {
    if (records.length === 0) continue;
    // Find the oldest record for the message body
    const oldest = records.reduce<typeof records[number]>((acc, r) => {
      const t = new Date(r.storage_start_date).getTime();
      return t < new Date(acc.storage_start_date).getTime() ? r : acc;
    }, records[0]!);
    const oldestDays = Math.floor(
      (Date.now() - new Date(oldest.storage_start_date).getTime()) / (24 * 60 * 60 * 1000)
    );
    const oldestCustomer = (oldest.customers as any)?.name || 'a customer';
    const totalBags = records.reduce((s, r) => s + (r.plot_bags || 0), 0);

    // Avoid duplicate notifications: skip if we already sent one in the
    // last 24 hours for this warehouse.
    const yesterdayISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('warehouse_id', warehouseId)
      .eq('category', 'inflow')
      .ilike('title', '%drying%')
      .gt('created_at', yesterdayISO);
    if ((recentCount || 0) > 0) continue;

    const title =
      records.length === 1
        ? '1 record pending drying finalization'
        : `${records.length} records pending drying finalization`;
    const message =
      `${totalBags.toLocaleString()} bags across ${records.length} record${records.length === 1 ? '' : 's'} ` +
      `still in drying. Oldest: #${oldest.record_number} (${oldestCustomer}, ${oldestDays} days). ` +
      `Tap to review.`;

    const { error: insertErr } = await supabase.from('notifications').insert({
      warehouse_id: warehouseId,
      user_id: null, // Warehouse-scoped — owner + admins see it
      title,
      message,
      type: 'warning',
      category: 'inflow',
      link: '/storage?filter=drying',
    });
    if (!insertErr) warehousesNotified++;
  }

  return NextResponse.json({
    success: true,
    warehouses_notified: warehousesNotified,
    stale_records: stale.length,
  });
}
