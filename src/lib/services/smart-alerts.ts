import { createClient } from '@/utils/supabase/server';
import { createSmartNotification } from './notification-service';
import { getUserWarehouse } from '../queries/warehouses';
import { getDashboardMetrics } from '../queries/storage';

/**
 * Check for aging stock (records > 180 days old)
 * Should run daily at 9 AM
 */
export async function checkAgingStock() {
  try {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    
    if (!warehouseId) return;
    
    const now = new Date();
    const { data: records } = await supabase
      .from('storage_records')
      .select('id, record_number, storage_start_date, customers(name)')
      .eq('warehouse_id', warehouseId)
      .is('storage_end_date', null)
      .is('deleted_at', null);
    
    if (!records) return;
    
    // Filter records older than 180 days
    const agingRecords = records.filter(r => {
      const startDate = new Date(r.storage_start_date);
      const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff > 180;
    });
    
    if (agingRecords.length > 0) {
      const customerNames = agingRecords
        .map((r: any) => r.customers?.name || 'Unknown')
        .slice(0, 3) // Show first 3
        .join(', ');
      
      const moreCount = agingRecords.length > 3 ? ` +${agingRecords.length - 3} more` : '';
      
      await createSmartNotification({
        warehouseId,
        type: 'aging_alert',
        severity: 'warning',
        title: 'Long-term Storage Alert',
        message: `${agingRecords.length} records over 180 days old: ${customerNames}${moreCount}`,
        metadata: {
          count: agingRecords.length,
          record_ids: agingRecords.map(r => r.id)
        },
        link: '/storage?filter=aging'
      });
    }
  } catch (error) {
    console.error('Error checking aging stock:', error);
  }
}

/**
 * Check for low warehouse space
 * Should run after each inflow or periodically
 */
export async function checkWarehouseSpace() {
  try {
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return;
    
    const metrics = await getDashboardMetrics();
    if (!metrics) return;
    
    const occupancy = (metrics.totalStock / metrics.totalCapacity) * 100;
    const remaining = metrics.totalCapacity - metrics.totalStock;
    
    // Critical alert (>95%)
    if (occupancy > 95) {
      await createSmartNotification({
        warehouseId,
        type: 'critical_space',
        severity: 'critical',
        title: 'Critical: Warehouse Nearly Full',
        message: `Only ${remaining.toLocaleString()} bags remaining! Warehouse ${occupancy.toFixed(1)}% full`,
        metadata: { occupancy, remaining },
        link: '/dashboard'
      });
    }
    // Warning alert (>85%)
    else if (occupancy > 85) {
      await createSmartNotification({
        warehouseId,
        type: 'low_space',
        severity: 'warning',
        title: 'Low Space Warning',
        message: `Warehouse ${occupancy.toFixed(1)}% full - ${remaining.toLocaleString()} bags remaining`,
        metadata: { occupancy, remaining },
        link: '/dashboard'
      });
    }
  } catch (error) {
    console.error('Error checking warehouse space:', error);
  }
}

/**
 * Check for high outstanding payments
 * Should run weekly (Mondays at 10 AM)
 */
export async function checkHighOutstanding() {
  try {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    
    if (!warehouseId) return;
    
    // Get all customers with outstanding amounts
    const { data: records } = await supabase
      .from('storage_records')
      .select(`
        customer_id,
        hamali_payable,
        insurance_payable,
        customers(name),
        withdrawal_transactions(rent_collected),
        payments(amount)
      `)
      .eq('warehouse_id', warehouseId)
      .is('deleted_at', null);

    if (!records) return;

    // Calculate outstanding per customer
    const customerOutstanding = new Map<string, { name: string; outstanding: number }>();

    records.forEach((r: any) => {
      const customerId = r.customer_id;
      const customerName = r.customers?.name || 'Unknown';

      // Calculate dues (rent + hamali + insurance)
      const withdrawals = r.withdrawal_transactions || [];
      const rentDue = withdrawals.reduce((sum: number, w: any) =>
        sum + (parseFloat(w.rent_collected) || 0), 0);
      const totalDue =
        rentDue + (r.hamali_payable || 0) + (r.insurance_payable || 0);
      
      // Calculate paid
      const payments = r.payments || [];
      const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      
      const outstanding = totalDue - totalPaid;
      
      if (!customerOutstanding.has(customerId)) {
        customerOutstanding.set(customerId, { name: customerName, outstanding: 0 });
      }
      
      const current = customerOutstanding.get(customerId)!;
      current.outstanding += outstanding;
    });
    
    // Filter customers with outstanding > ₹50,000
    const highOutstanding = Array.from(customerOutstanding.values())
      .filter(c => c.outstanding > 50000);
    
    if (highOutstanding.length > 0) {
      const totalOutstanding = highOutstanding.reduce((sum, c) => sum + c.outstanding, 0);
      const customerNames = highOutstanding
        .slice(0, 3)
        .map(c => c.name)
        .join(', ');
      
      const moreCount = highOutstanding.length > 3 ? ` +${highOutstanding.length - 3} more` : '';
      
      await createSmartNotification({
        warehouseId,
        type: 'payment_overdue',
        severity: 'warning',
        title: 'High Outstanding Payments',
        message: `${highOutstanding.length} customers owe > ₹50,000 (Total: ₹${totalOutstanding.toLocaleString()}): ${customerNames}${moreCount}`,
        metadata: {
          count: highOutstanding. length,
          total: totalOutstanding,
          customers: highOutstanding.map(c => ({ name: c.name, amount: c.outstanding }))
        },
        link: '/reports/custom?type=pending-dues'
      });
    }
  } catch (error) {
    console.error('Error checking high outstanding:', error);
  }
}

/**
 * Generate monthly business summary
 * Should run on 1st of each month at 8 AM
 */
export async function generateMonthlySummary() {
  try {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    
    if (!warehouseId) return;
    
    // Get last month's date range
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const monthName = lastMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    // Get inflows
    const { count: inflowCount } = await supabase
      .from('storage_records')
      .select('*', { count: 'exact', head: true })
      .eq('warehouse_id', warehouseId)
      .gte('storage_start_date', lastMonth.toISOString())
      .lte('storage_start_date', lastMonthEnd.toISOString());
    
    // Get bags in
    const { data: inflowData } = await supabase
      .from('storage_records')
      .select('bags_stored')
      .eq('warehouse_id', warehouseId)
      .gte('storage_start_date', lastMonth.toISOString())
      .lte('storage_start_date', lastMonthEnd.toISOString());
    
    const totalBagsIn = inflowData?.reduce((sum, r) => sum + (r.bags_stored || 0), 0) || 0;
    
    // Get withdrawals
    const { data: withdrawalData } = await supabase
      .from('withdrawal_transactions')
      .select('bags_withdrawn, rent_collected')
      .gte('withdrawal_date', lastMonth.toISOString())
      .lte('withdrawal_date', lastMonthEnd.toISOString());
    
    const totalBagsOut = withdrawalData?.reduce((sum, w) => sum + (w.bags_withdrawn || 0), 0) || 0;
    const totalRent = withdrawalData?.reduce((sum, w) => sum + (parseFloat(w.rent_collected) || 0), 0) || 0;
    
    // Get payments
    const { data: paymentData } = await supabase
      .from('payments')
      .select('amount')
      .gte('payment_date', lastMonth.toISOString())
      .lte('payment_date', lastMonthEnd.toISOString());
    
    const totalPayments = paymentData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    
    await createSmartNotification({
      warehouseId,
      type: 'monthly_summary',
      severity: 'info',
      title: `${monthName} Business Summary`,
      message: `${totalBagsIn.toLocaleString()} bags in, ${totalBagsOut.toLocaleString()} bags out, ₹${totalPayments.toLocaleString()} collected from ${inflowCount || 0} records`,
      metadata: {
        month: monthName,
        inflowCount: inflowCount || 0,
        bagsIn: totalBagsIn,
        bagsOut: totalBagsOut,
        rentBilled: totalRent,
        paymentsCollected: totalPayments
      },
      link: '/analytics'
    });
  } catch (error) {
    console.error('Error generating monthly summary:', error);
  }
}
