'use server';

import { createClient } from '@/utils/supabase/server';
import { getUserWarehouse } from '@/lib/queries';
import { logError } from './error-logger';

  export async function fetchReportData(
    reportType: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      customerId?: string;
      includeHistory?: boolean;
      duesType?: 'all' | 'hamali';
    }
  ) {
    try {
      const supabase = await createClient();
      const warehouseId = await getUserWarehouse();
  
      if (!warehouseId) {
        throw new Error('Unauthorized');
      }
  
      // 0. Customer Dues Details (Single Customer)
      if (reportType === 'customer-dues-details') {
        if (!filters?.customerId) throw new Error("Customer ID required");

        const { data: customer } = await supabase.from('customers').select('*').eq('id', filters.customerId).single();
        if (!customer) throw new Error("Customer not found");
  
        // Fetch ALL records for customer WITH withdrawal transactions AND payment details
        const { data: records } = await supabase
          .from('storage_records')
          .select(`
              *,
              payments (amount, type, payment_date, notes, deleted_at),
              withdrawal_transactions (bags_withdrawn, withdrawal_date, rent_collected, deleted_at)
          `)
          .eq('customer_id', filters.customerId)
          .eq('warehouse_id', warehouseId)
          .is('deleted_at', null)
          .order('storage_start_date', { ascending: false });

        if (!records) return { type: 'customer-dues-details', data: [], customer };

        const processedRecords = records.map((record: any) => {
            // 1. Calculate Rent Due - SUM ALL WITHDRAWAL TRANSACTIONS
            let rentDue = 0;
            let isprojected = false;

            // Filter: If Hamali Only, ignore Rent Logic entirely
            if (filters?.duesType !== 'hamali') {
                // Sum rent from all NON-DELETED withdrawal transactions for this record
                const withdrawals = (record.withdrawal_transactions || []).filter((w: any) => !w.deleted_at);
                rentDue = withdrawals.reduce((sum: number, w: any) => 
                  sum + (parseFloat(w.rent_collected) || 0), 0);
                
                // Note: Records with no withdrawals will have rentDue = 0
            }
  
            // 2. Hamali Due - FOR ALL RECORDS (both active and closed)
            const hamaliDue = record.hamali_payable || 0;

            // 2b. Insurance Due
            const insuranceDue = record.insurance_payable || 0;

            // 3. Payments made against THIS record (excluding soft-deleted)
            let rentPaid = 0;
            let hamaliPaid = 0;
            let insurancePaid = 0;
            let otherPaid = 0;

            (record.payments || []).filter((p: any) => !p.deleted_at).forEach((p: any) => {
                 if (p.type === 'rent') rentPaid += p.amount;
                 else if (p.type === 'hamali') hamaliPaid += p.amount;
                 else if (p.type === 'insurance') insurancePaid += p.amount;
                 else otherPaid += p.amount;
            });

            // Allocation of 'other' payments -> prioritize Hamali, then Insurance, then Rent
            let remaining = otherPaid;
            if (remaining > 0) {
                const hamaliBalance = Math.max(0, hamaliDue - hamaliPaid);
                const take = Math.min(hamaliBalance, remaining);
                hamaliPaid += take;
                remaining -= take;
            }
            if (remaining > 0) {
                const insuranceBalance = Math.max(0, insuranceDue - insurancePaid);
                const take = Math.min(insuranceBalance, remaining);
                insurancePaid += take;
                remaining -= take;
            }
            if (remaining > 0 && filters?.duesType !== 'hamali') {
                const rentBalance = Math.max(0, rentDue - rentPaid);
                const take = Math.min(remaining, rentBalance);
                rentPaid += take;
                remaining -= take;
            }

            // If Hamali Only, zero out Rent Paid if it was somehow tracked?
            if (filters?.duesType === 'hamali') {
                rentPaid = 0;
            }

            const rentBalance = Math.max(0, rentDue - rentPaid);
            const hamaliBalance = Math.max(0, hamaliDue - hamaliPaid);
            const insuranceBalance = Math.max(0, insuranceDue - insurancePaid);
            const totalBalance = rentBalance + hamaliBalance + insuranceBalance;
  
            return {
                recordId: record.id,
                recordNumber: record.record_number || record.id.substring(0, 8),
                date: record.storage_start_date,
                endDate: record.storage_end_date,
                commodity: record.commodity_description,
                bags: record.bags_stored,
                status: record.storage_end_date ? 'Closed' : 'Active',
                rentDue: Math.round(rentDue),
                hamaliDue: Math.round(hamaliDue),
                insuranceDue: Math.round(insuranceDue),
                rentPaid: Math.round(rentPaid),
                hamaliPaid: Math.round(hamaliPaid),
                insurancePaid: Math.round(insurancePaid),
                rentBalance: Math.round(rentBalance),
                hamaliBalance: Math.round(hamaliBalance),
                insuranceBalance: Math.round(insuranceBalance),
                totalBalance: Math.round(totalBalance),
                isProjected: isprojected,
                withdrawalTransactions: (record.withdrawal_transactions || []).filter((w: any) => !w.deleted_at), // Pass for PDF export
                payments: (record.payments || []).filter((p: any) => !p.deleted_at) // Pass payment history for PDF export
            };
        });
  
        // Sort: Active first, then by date desc
        processedRecords.sort((a, b) => {
            if (a.status === 'Active' && b.status !== 'Active') return -1;
            if (a.status !== 'Active' && b.status === 'Active') return 1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
  
        const finalData = processedRecords.filter(r => 
            filters.includeHistory || r.totalBalance > 0 || r.status === 'Active'
        );
  
        // BUILD STATEMENT OF ACCOUNT - Chronological Transaction Ledger
        const transactions: any[] = [];
        
        records.forEach((record: any) => {
          transactions.push({
            date: record.storage_start_date,
            type: 'inflow',
            description: `Inflow - ${record.commodity_description || 'Storage'}`,
            invoiceNo: record.record_number || record.id.substring(0, 8),
            bagsIn: record.bags_in || (record.bags_stored + (record.withdrawal_transactions || []).filter((w: any) => !w.deleted_at).reduce((sum: number, w: any) => sum + (w.bags_withdrawn || 0), 0)),
            bagsOut: null,
            hamali: record.hamali_payable || 0,
            insurance: record.insurance_payable || 0,
            rent: null,
            credit: null
          });
          
          (record.withdrawal_transactions || []).filter((wt: any) => !wt.deleted_at).forEach((wt: any) => {
            transactions.push({
              date: wt.withdrawal_date,
              type: 'outflow',
              description: 'Outflow',
              invoiceNo: record.record_number || record.id.substring(0, 8),
              bagsIn: null,
              bagsOut: wt.bags_withdrawn,
              hamali: null,
              rent: parseFloat(wt.rent_collected) || 0,
              credit: null
            });
          });
          
          (record.payments || []).forEach((p: any) => {
            transactions.push({
              date: p.payment_date,
              type: 'payment',
              description: `Payment - ${p.type || 'General'}`,
              invoiceNo: record.record_number || record.id.substring(0, 8),
              bagsIn: null,
              bagsOut: null,
              hamali: null,
              rent: null,
              credit: p.amount
            });
          });
        });
        
        transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = 0;
        transactions.forEach(t => {
          runningBalance += (t.hamali || 0) + (t.insurance || 0) + (t.rent || 0) - (t.credit || 0);
          t.balance = runningBalance;
        });

        const summary = {
          totalBagsIn: transactions.filter(t => t.type === 'inflow').reduce((sum, t) => sum + (t.bagsIn || 0), 0),
          totalBagsOut: transactions.filter(t => t.type === 'outflow').reduce((sum, t) => sum + (t.bagsOut || 0), 0),
          balanceStock: 0,
          totalHamali: transactions.filter(t => t.type === 'inflow').reduce((sum, t) => sum + (t.hamali || 0), 0),
          totalInsurance: transactions.filter(t => t.type === 'inflow').reduce((sum, t) => sum + (t.insurance || 0), 0),
          totalRent: transactions.filter(t => t.type === 'outflow').reduce((sum, t) => sum + (t.rent || 0), 0),
          totalPaid: transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + (t.credit || 0), 0),
          balanceDue: 0
        };
        
        summary.balanceStock = summary.totalBagsIn - summary.totalBagsOut;
        summary.balanceDue = (summary.totalHamali + summary.totalInsurance + summary.totalRent) - summary.totalPaid;
  
        return {
            type: 'customer-dues-details',
            data: finalData,
            customer,
            transactions,
            summary,
            duesType: filters.duesType
        };
    }

  // 1. All Customers Report
  if (reportType === 'all-customers') {
    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .order('name');
      
    // Fetch all records with withdrawals and payments
    const { data: activeRecords } = await supabase
      .from('storage_records')
      .select(`
        customer_id, 
        bags_stored, 
        storage_start_date,
        storage_end_date,
        created_at,
        updated_at,
        payments (amount, payment_date, deleted_at),
        withdrawal_transactions (bags_withdrawn, rent_collected, withdrawal_date, deleted_at)
      `)
      .eq('warehouse_id', warehouseId)
      .is('deleted_at', null);

    // Calculate comprehensive stats per customer
    const customersWithStats = customers?.map(c => {
      const customerRecords = activeRecords?.filter(r => r.customer_id === c.id) || [];

      let totalDues = 0;
      let totalPaid = 0;
      let totalBagsIn = 0;
      let totalBagsOut = 0;
      let activeBags = 0;
      let lastActivityDate: Date | null = null;

      customerRecords.forEach((r: any) => {
        // Track bags in (total stored across all records)
        totalBagsIn += r.bags_stored || 0;

        // Track bags out (only non-deleted withdrawals)
        const withdrawals = (r.withdrawal_transactions || []).filter((w: any) => !w.deleted_at);
        const bagsWithdrawn = withdrawals.reduce((sum: number, w: any) => 
          sum + (w.bags_withdrawn || 0), 0);
        totalBagsOut += bagsWithdrawn;
        
        // Calculate actual rent from withdrawals
        const rentFromWithdrawals = withdrawals.reduce((sum: number, w: any) => 
          sum + (parseFloat(w.rent_collected) || 0), 0);
        
        totalDues += rentFromWithdrawals + (r.hamali_payable || 0);
        
        // Track payments (only non-deleted)
        const payments = (r.payments || []).filter((p: any) => !p.deleted_at);
        const recordPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        totalPaid += recordPaid;
        
        // Count active bags (not yet withdrawn)
        if (!r.storage_end_date) {
          activeBags += (r.bags_stored || 0) - bagsWithdrawn;
        }
        
        // Track last activity (latest of: storage_start, withdrawal, payment, update)
        const dates = [
          new Date(r.storage_start_date),
          new Date(r.updated_at),
          ...withdrawals.map((w: any) => new Date(w.withdrawal_date)),
          ...payments.map((p: any) => new Date(p.payment_date))
        ];
        const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
        if (!lastActivityDate || latestDate > lastActivityDate) {
          lastActivityDate = latestDate;
        }
      });
      
      const outstanding = Math.max(0, totalDues - totalPaid);
      const balanceStock = totalBagsIn - totalBagsOut;
      
      // Determine payment status
      let paymentStatus = 'paid';
      if (outstanding > 1) {
        paymentStatus = totalPaid > 0 ? 'partial' : 'unpaid';
      }
      
      return {
        ...c,
        totalBagsIn,
        totalBagsOut,
        balanceStock,
        activeBags,
        totalDues,
        totalPaid,
        outstanding,
        lastActivity: lastActivityDate,
        paymentStatus,
        recordCount: customerRecords.length
      };
    }) || customers;
    
    return { 
      type: 'all-customers', 
      data: customersWithStats
    };
  }

  // 2. Active Inventory Report
  if (reportType === 'active-inventory') {
    const { data: records } = await supabase
      .from('storage_records')
      .select(`
        *,
        customers (name, customer_number),
        withdrawal_transactions (bags_withdrawn, deleted_at)
      `)
      .eq('warehouse_id', warehouseId)
      .is('storage_end_date', null)
      .is('deleted_at', null)
      .order('storage_start_date');
    
    // Add aging analysis and calculate net stock
    const now = new Date();
    const recordsWithAging = records?.map(r => {
      const startDate = new Date(r.storage_start_date);
      const daysInStorage = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate Stock dynamically: Inflow - Outflows
      let currentStock = r.bags_stored;
      if (r.bags_in !== null && r.bags_in !== undefined) {
          const totalWithdrawn = (r.withdrawal_transactions || []).filter((w: any) => !w.deleted_at).reduce((sum: number, w: any) => sum + (w.bags_withdrawn || 0), 0);
          currentStock = r.bags_in - totalWithdrawn;
      }
      
      // Categorize by age
      let ageCategory = 'Recent';  // 0-30 days
      if (daysInStorage > 180) ageCategory = 'Very Old';      // > 6 months
      else if (daysInStorage > 90) ageCategory = 'Old';       // 3-6 months
      else if (daysInStorage > 30) ageCategory = 'Medium';    // 1-3 months
      
      return {
        ...r,
        bags_stored: currentStock, // Use calculated stock
        daysInStorage,
        ageCategory
      };
    }).filter(r => r.bags_stored > 0) || []; // Show only available stock
      
    return {
      type: 'active-inventory',
      data: recordsWithAging
    };
  }

  // 3. Inflow Register (Filtered by Start Date)
  if (reportType === 'inflow-register') {
    let query = supabase
      .from('storage_records')
      .select(`
        *,
        customers (name, customer_number)
      `)
      .eq('warehouse_id', warehouseId)
      .is('deleted_at', null)
      .order('storage_start_date', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('storage_start_date', filters.startDate);
    }
    if (filters?.endDate) {
      // Add one day to end date to make it inclusive/cover full day if time is involved
      // or just use straight comparison if dates are purely YYYY-MM-DD
      const nextDay = new Date(filters.endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query = query.lt('storage_start_date', nextDay.toISOString());
    }

    const { data: records } = await query;
    return {
      type: 'inflow-register',
      data: records,
      period: filters
    };
  }

  // 4. Outflow Register - Shows individual withdrawal transactions
  if (reportType === 'outflow-register') {
    const baseQuery = supabase
      .from('withdrawal_transactions')
      .select(`
        id,
        withdrawal_number,
        withdrawal_date,
        bags_withdrawn,
        rent_collected,
        storage_record_id,
        storage_records (
          id,
          record_number,
          commodity_description,
          customer_id,
          hamali_payable,
          total_rent_billed,
          insurance_payable,
          customers (
            id,
            name,
            customer_number
          ),
          payments (amount)
        )
      `)
      .eq('warehouse_id', warehouseId)
      .is('deleted_at', null)
      .order('withdrawal_date', { ascending: false });

    const { data: allRecords, error: queryError } = await baseQuery;

    if (queryError) {
      throw queryError;
    }

    // Apply date filters on withdrawal_date
    let filteredRecords = allRecords || [];

    if (filters?.startDate) {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      filteredRecords = filteredRecords.filter(r => {
        const recordDate = new Date(r.withdrawal_date);
        return recordDate >= startDate;
      });
    }

    if (filters?.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filteredRecords = filteredRecords.filter(r => {
        const recordDate = new Date(r.withdrawal_date);
        return recordDate <= endDate;
      });
    }

    // Transform to match expected format
    const transformedData = filteredRecords.map(record => {
      // Supabase returns storage_records as an object (not array) when using foreign key relationship
      const storageRecord = record.storage_records as any;

      // Aggregate payments for the parent storage record (at record level, not per-withdrawal)
      const recordPayments = (storageRecord?.payments || []) as Array<{ amount: number | string }>;
      const recordTotalPaid = recordPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const recordTotalBilled =
        Number(storageRecord?.total_rent_billed || 0) +
        Number(storageRecord?.hamali_payable || 0) +
        Number(storageRecord?.insurance_payable || 0);
      const recordBalance = Math.max(0, recordTotalBilled - recordTotalPaid);

      return {
        id: record.id,
        withdrawal_number: record.withdrawal_number,
        record_number: storageRecord?.record_number,
        storage_end_date: record.withdrawal_date, // Use withdrawal_date as the "outflow date"
        commodity_description: storageRecord?.commodity_description,
        bags_stored: record.bags_withdrawn, // Bags withdrawn in this transaction
        total_rent_billed: parseFloat(record.rent_collected || '0'),
        hamali_payable: 0, // Not tracked at withdrawal level
        record_total_billed: recordTotalBilled,
        record_total_paid: recordTotalPaid,
        record_balance: recordBalance,
        customer_id: storageRecord?.customer_id,
        customers: storageRecord?.customers,
      };
    });

    return {
      type: 'outflow-register',
      data: transformedData,
      period: filters
    };
  }

  // 5. Payment Register (Filtered by Payment Date)
  if (reportType === 'payment-register') {
    let query = supabase
      .from('payments')
      .select(`
        *,
        storage_records!inner (
          record_number,
          id,
          commodity_description,
          warehouse_id,
          customers ( name, customer_number )
        )
      `)
      .eq('storage_records.warehouse_id', warehouseId)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('payment_date', filters.startDate);
    }
    if (filters?.endDate) {
      const nextDay = new Date(filters.endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query = query.lt('payment_date', nextDay.toISOString());
    }

    const { data: payments } = await query;
    return {
      type: 'payment-register',
      data: payments,
      period: filters
    };
  }

  // 6. Pending Dues List
  if (reportType === 'pending-dues') {
    // This requires calculating totals. A bit complex in one query.
    // Strategy: Fetch all customers, and all records with outstanding dues.
    
    // 1. Fetch Customers
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone, village')
      .eq('warehouse_id', warehouseId)
      .order('name');
      
    if (!customers) return { type: 'pending-dues', data: [] };

    // 2. Fetch all records (simplified: active ones + ones with partial payments?)
    // Actually, simple "Pending Dues" usually means balance > 0.
    // Fetch records where balance > 0 isn't direct column.
    // We need to fetch all records, or at least active ones and ones where paid < billed.
    // For simplicity/performance, let's fetch active records (dues accumulate) 
    // and inactive records where we might want to track checking...
    // Let's stick to "Active Records" for now as the main source of current dues.
    // OR better: Fetch *all* records for these customers and compute.
    // BUT fetching ALL records is heavy.
    // Compromise: Fetch ACTIVE records + Records closed in last 3 months?
    // Let's just fetch ACTIVE records for now as that's 90% of "Dues". Closed records usually settled.
    
    const { data: records } = await supabase
      .from('storage_records')
      .select(`
        *,
        payments (amount, deleted_at),
        withdrawal_transactions (rent_collected, deleted_at)
      `)
      .eq('warehouse_id', warehouseId)
      .is('deleted_at', null);
      // Ideally we filter where total_rent + hamali > total_paid

    // Filter in memory for precise calculation
    const reportData = customers.map(c => {
       const userRecords = records?.filter((r: any) => r.customer_id === c.id) || [];
       let totalDues = 0;
       let totalPaid = 0;

       userRecords.forEach((r: any) => {
         // Calculate rent from non-deleted withdrawal transactions only
         const withdrawals = (r.withdrawal_transactions || []).filter((w: any) => !w.deleted_at);
         const rentFromWithdrawals = withdrawals.reduce((sum: number, w: any) =>
           sum + (parseFloat(w.rent_collected) || 0), 0);

         // Include insurance — was previously missing, causing customers whose
         // only outstanding amount was insurance to be filtered out of the
         // Pending Dues list even though their Statement of Account showed
         // the balance correctly.
         const billed = rentFromWithdrawals + (r.hamali_payable || 0) + (r.insurance_payable || 0);

         const paid = (r.payments || []).filter((p: any) => !p.deleted_at).reduce((sum: number, p: any) => sum + p.amount, 0);
         totalDues += billed;
         totalPaid += paid;
       });

       return {
         ...c,
         totalDues,
         totalPaid,
         balance: totalDues - totalPaid
       };
    }).filter(c => c.balance > 1) // Only showing > 1 to avoid rounding noise
       .sort((a, b) => b.balance - a.balance); // Sort by outstanding DESC

    return {
      type: 'pending-dues',
      data: reportData
    };
  }

  // 6b. Rent Pending Breakdown (Detailed)
  if (reportType === 'rent-pending-breakdown') {
      // Similar to pending-dues but returns raw details per customer for table display
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, phone, village')
        .eq('warehouse_id', warehouseId)
        .order('name');
        
      if (!customers) return { type: 'rent-pending-breakdown', data: [] };
  
      const { data: records } = await supabase
        .from('storage_records')
        .select(`
          *,
          payments (amount, type, deleted_at),
          withdrawal_transactions (rent_collected, deleted_at)
        `)
        .eq('warehouse_id', warehouseId)
        .is('deleted_at', null);

      const reportData = customers.map(c => {
         const userRecords = records?.filter((r: any) => r.customer_id === c.id) || [];
         let rentBilled = 0;
         let hamaliBilled = 0;
         let insuranceBilled = 0;
         let rentPaid = 0;
         let hamaliPaid = 0;
         let insurancePaid = 0;
         let otherPaid = 0; // Payments without type or 'other'

         userRecords.forEach((r: any) => {
           // Calculate actual rent from non-deleted withdrawal transactions
           const withdrawals = (r.withdrawal_transactions || []).filter((w: any) => !w.deleted_at);
           const rentFromWithdrawals = withdrawals.reduce((sum: number, w: any) =>
             sum + (parseFloat(w.rent_collected) || 0), 0);

           rentBilled += rentFromWithdrawals;
           hamaliBilled += (r.hamali_payable || 0);
           insuranceBilled += (r.insurance_payable || 0);

           (r.payments || []).filter((p: any) => !p.deleted_at).forEach((p: any) => {
               if (p.type === 'rent') rentPaid += p.amount;
               else if (p.type === 'hamali') hamaliPaid += p.amount;
               else if (p.type === 'insurance') insurancePaid += p.amount;
               else otherPaid += p.amount;
           });
         });

         // Allocate generic ('other') payments in order: Hamali → Insurance → Rent
         // (matches the order used by the Customer Dues report so the numbers
         // agree across screens).
         let remainingOther = otherPaid;

         let hamaliPending = hamaliBilled - hamaliPaid;
         if (remainingOther > 0 && hamaliPending > 0) {
             const deduct = Math.min(remainingOther, hamaliPending);
             hamaliPending -= deduct;
             remainingOther -= deduct;
             hamaliPaid += deduct;
         }

         let insurancePending = insuranceBilled - insurancePaid;
         if (remainingOther > 0 && insurancePending > 0) {
             const deduct = Math.min(remainingOther, insurancePending);
             insurancePending -= deduct;
             remainingOther -= deduct;
             insurancePaid += deduct;
         }

         let rentPending = rentBilled - rentPaid;
         if (remainingOther > 0 && rentPending > 0) {
             const deduct = Math.min(remainingOther, rentPending);
             rentPending -= deduct;
             remainingOther -= deduct;
             rentPaid += deduct;
         }

         const totalPending = rentPending + hamaliPending + insurancePending;

         return {
           ...c,
           rentBilled,
           hamaliBilled,
           insuranceBilled,
           rentPaid,
           hamaliPaid,
           insurancePaid,
           rentPending,
           hamaliPending,
           insurancePending,
           totalPending
         };
      }).filter(c => c.totalPending > 1);
  
      return {
        type: 'rent-pending-breakdown',
        data: reportData
      };
  }

  // 7. Lot Inventory Report
  if (reportType === 'lot-inventory') {
    const { data: records } = await supabase
      .from('storage_records')
      .select(`
        bags_stored,
        warehouse_lots (name),
        customers (name, customer_number),
        crops (name)
      `)
      .eq('warehouse_id', warehouseId)
      .is('storage_end_date', null)
      .is('deleted_at', null);

    if (!records) return { type: 'lot-inventory', data: [] };

    // Group in memory: Lot -> Customer -> Crop -> Total Bags
    const groupedData: any[] = [];
    const map = new Map<string, number>();

    records.forEach((r: any) => {
      const lotName = r.warehouse_lots?.name || 'Unassigned';
      const customerName = r.customers?.name || 'Unknown';
      const cropName = r.crops?.name || 'Unknown';
      const key = `${lotName}|${customerName}|${cropName}`;
      
      map.set(key, (map.get(key) || 0) + (r.bags_stored || 0));
    });

    map.forEach((totalBags, key) => {
      const [lot_name, customer_name, crop_name] = key.split('|');
      groupedData.push({
        lot_name,
        customer_name,
        crop_name,
        total_bags: totalBags
      });
    });

    // Sort by lot name and then customer name
    groupedData.sort((a, b) => {
      if (a.lot_name !== b.lot_name) return a.lot_name.localeCompare(b.lot_name);
      return a.customer_name.localeCompare(b.customer_name);
    });

    return {
      type: 'lot-inventory',
      data: groupedData
    };
  }

  // 8. Transaction History (Last 1000 Recent Transactions)
  if (reportType === 'transaction-history') {
    const { data: records } = await supabase
      .from('storage_records')
      .select(`
        *,
        customers (name, customer_number),
        withdrawal_transactions (withdrawal_date, bags_withdrawn, rent_collected, deleted_at),
        payments (payment_date, amount, type, deleted_at)
      `)
      .eq('warehouse_id', warehouseId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1000);
    
    // Transform into transaction entries grouped by date
    const transactions: any[] = [];
    
    records?.forEach(r => {
      // Inflow transaction
      transactions.push({
        date: new Date(r.storage_start_date),
        type: 'inflow',
        recordNumber: r.record_number,
        customerName: r.customers?.name,
        commodity: r.commodity_description,
        bags: r.bags_stored,
        amount: r.hamali_payable,
        description: `Inflow - ${r.bags_stored} bags received`
      });
      
      // Withdrawal transactions (skip soft-deleted)
      r.withdrawal_transactions?.filter((w: any) => !w.deleted_at).forEach((w: any) => {
        transactions.push({
          date: new Date(w.withdrawal_date),
          type: 'outflow',
          recordNumber: r.record_number,
          customerName: r.customers?.name,
          commodity: r.commodity_description,
          bags: w.bags_withdrawn,
          amount: w.rent_collected,
          description: `Outflow - ${w.bags_withdrawn} bags withdrawn`
        });
      });

      // Payment transactions (skip soft-deleted)
      r.payments?.filter((p: any) => !p.deleted_at).forEach((p: any) => {
        transactions.push({
          date: new Date(p.payment_date),
          type: 'payment',
          recordNumber: r.record_number,
          customerName: r.customers?.name,
          bags: 0,
          amount: p.amount,
          paymentType: p.type,
          description: `Payment - ${p.type || 'general'}`
        });
      });
    });
    
    // Sort by date descending
    transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Group by date for daily totals
    const groupedByDate = transactions.reduce((acc: any, t) => {
      const dateKey = t.date.toLocaleDateString();
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(t);
      return acc;
    }, {});
    
    return {
      type: 'transaction-history',
      data: transactions,
      groupedByDate
    };
  }

  // 9. Hamali Register (Revenue)
  if (reportType === 'hamali-register') {
    let query = supabase
      .from('storage_records')
      .select(`
        *,
        customers (name, customer_number)
      `)
      .eq('warehouse_id', warehouseId)
      .is('deleted_at', null)
      .gt('hamali_payable', 0)
      .order('storage_start_date', { ascending: false });

    if (filters?.startDate) query = query.gte('storage_start_date', filters.startDate);
    if (filters?.endDate) {
        const nextDay = new Date(filters.endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt('storage_start_date', nextDay.toISOString());
    }

    const { data: records } = await query;
    
    // Map snake_case to camelCase for UI compatibility and flatten customer
    const mappedRecords = records?.map((r: any) => ({
        ...r,
        storageStartDate: r.storage_start_date,
        storageEndDate: r.storage_end_date,
        bagsStored: r.bags_stored,
        bagsIn: r.bags_in || r.bags_stored, // Fallback if bags_in not tracked directly
        bagsOut: r.bags_out || 0,
        hamaliPayable: r.hamali_payable,
        totalRentBilled: r.total_rent_billed,
        customerId: r.customer_id,
        // Ensure customer object is accessible as 'customer' (standard) or use joined 'customers'
        customer: r.customers || r.customer,
        payments: r.payments || []
    }));

    return { type: 'hamali-register', data: mappedRecords, period: filters };
  }

  // 10. Unloading Register (Operational)
  if (reportType === 'unloading-register') {
    let query = supabase
        .from('unloading_records')
        .select(`
            *,
            customer:customers(name, customer_number),
            crop:crops(name)
        `)
        .eq('warehouse_id', warehouseId)
        .is('deleted_at', null)
        .order('unload_date', { ascending: false });
    
    if (filters?.startDate) query = query.gte('unload_date', filters.startDate);
    if (filters?.endDate) {
        const nextDay = new Date(filters.endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt('unload_date', nextDay.toISOString());
    }

    const { data: records } = await query;
    return { type: 'unloading-register', data: records, period: filters };
  }

  // 11. Unloading Expenses
  if (reportType === 'unloading-expenses') {
      let query = supabase
          .from('expenses')
          .select('*')
          .eq('warehouse_id', warehouseId)
          .eq('category', 'Hamali')
          .is('deleted_at', null)
          .order('expense_date', { ascending: false });
      
      if (filters?.startDate) query = query.gte('expense_date', filters.startDate);
      if (filters?.endDate) {
          const nextDay = new Date(filters.endDate);
          nextDay.setDate(nextDay.getDate() + 1);
          query = query.lt('expense_date', nextDay.toISOString());
      }
      
      const { data: expenses } = await query;
      return { type: 'unloading-expenses', data: expenses, period: filters };
  }
  
      return null;
    } catch (error: any) {
      logError(error, { operation: 'fetchReportData', metadata: { reportType, filters } });
      throw error;
    }
  }

  /**
   * Lightweight count + total quantity preview for the report generator UI.
   * Returns { count, totalQuantity, quantityLabel } without fetching full data.
   */
  export async function fetchReportCount(
    reportType: string,
    filters?: {
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ count: number; totalQuantity: number; quantityLabel: string } | null> {
    try {
      const supabase = await createClient();
      const warehouseId = await getUserWarehouse();
      if (!warehouseId) return null;

      if (reportType === 'inflow-register') {
        let query = supabase
          .from('storage_records')
          .select('bags_in, bags_stored', { count: 'exact' })
          .eq('warehouse_id', warehouseId)
          .is('deleted_at', null);

        if (filters?.startDate) query = query.gte('storage_start_date', filters.startDate);
        if (filters?.endDate) {
          const nextDay = new Date(filters.endDate);
          nextDay.setDate(nextDay.getDate() + 1);
          query = query.lt('storage_start_date', nextDay.toISOString());
        }

        const { data, count } = await query;
        const totalBags = data?.reduce((sum, r: any) => sum + (r.bags_in || r.bags_stored || 0), 0) || 0;
        return { count: count || 0, totalQuantity: totalBags, quantityLabel: 'bags received' };
      }

      if (reportType === 'outflow-register') {
        let query = supabase
          .from('withdrawal_transactions')
          .select('bags_withdrawn', { count: 'exact' })
          .eq('warehouse_id', warehouseId)
          .is('deleted_at', null);

        if (filters?.startDate) query = query.gte('withdrawal_date', filters.startDate);
        if (filters?.endDate) {
          const nextDay = new Date(filters.endDate);
          nextDay.setDate(nextDay.getDate() + 1);
          query = query.lt('withdrawal_date', nextDay.toISOString());
        }

        const { data, count } = await query;
        const totalBags = data?.reduce((sum, r: any) => sum + (r.bags_withdrawn || 0), 0) || 0;
        return { count: count || 0, totalQuantity: totalBags, quantityLabel: 'bags withdrawn' };
      }

      if (reportType === 'payment-register') {
        let query = supabase
          .from('payments')
          .select('amount', { count: 'exact' })
          .eq('warehouse_id', warehouseId)
          .is('deleted_at', null);

        if (filters?.startDate) query = query.gte('payment_date', filters.startDate);
        if (filters?.endDate) {
          const nextDay = new Date(filters.endDate);
          nextDay.setDate(nextDay.getDate() + 1);
          query = query.lt('payment_date', nextDay.toISOString());
        }

        const { data, count } = await query;
        const totalAmount = data?.reduce((sum, r: any) => sum + (r.amount || 0), 0) || 0;
        return { count: count || 0, totalQuantity: totalAmount, quantityLabel: 'total amount (₹)' };
      }

      // Non-date-range reports — count only
      if (reportType === 'all-customers') {
        const { count } = await supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('warehouse_id', warehouseId);
        return { count: count || 0, totalQuantity: 0, quantityLabel: '' };
      }

      if (reportType === 'active-inventory') {
        const { data, count } = await supabase
          .from('storage_records')
          .select('bags_stored', { count: 'exact' })
          .eq('warehouse_id', warehouseId)
          .is('storage_end_date', null)
          .is('deleted_at', null);
        const totalBags = data?.reduce((sum, r: any) => sum + (r.bags_stored || 0), 0) || 0;
        return { count: count || 0, totalQuantity: totalBags, quantityLabel: 'bags in stock' };
      }

      if (reportType === 'pending-dues') {
        const { count } = await supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('warehouse_id', warehouseId);
        return { count: count || 0, totalQuantity: 0, quantityLabel: '' };
      }

      if (reportType === 'lot-inventory') {
        const { data, count } = await supabase
          .from('storage_records')
          .select('bags_stored', { count: 'exact' })
          .eq('warehouse_id', warehouseId)
          .is('storage_end_date', null)
          .is('deleted_at', null);
        const totalBags = data?.reduce((sum, r: any) => sum + (r.bags_stored || 0), 0) || 0;
        return { count: count || 0, totalQuantity: totalBags, quantityLabel: 'bags mapped' };
      }

      return null;
    } catch {
      return null;
    }
  }
