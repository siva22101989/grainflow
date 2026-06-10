import { createClient } from '@/utils/supabase/server';
import { cache } from 'react';
import type { Expense } from '@/lib/definitions';
import type { ExpenseQueryOptions } from '@/lib/types/query-options';
import { logError } from '@/lib/error-logger';
import { getUserWarehouse } from './warehouses';

export const getFinancialStats = cache(async () => {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    if (!warehouseId) return { totalIncome: 0, totalExpenses: 0, totalBalance: 0 };

    // Parallel fetch for better performance
    const [{ data: payments }, { data: expenses }] = await Promise.all([
        supabase
            .from('payments')
            .select(`
                amount,
                type,
                storage_record:storage_records!inner(warehouse_id)
            `)
            .eq('storage_record.warehouse_id', warehouseId)
            .is('deleted_at', null),
        supabase
            .from('expenses')
            .select('amount')
            .eq('warehouse_id', warehouseId)
            .is('deleted_at', null)
    ]);

    // Waivers/discounts are stored as payment rows so they reduce balances, but
    // they are forgiven money — never count them as income.
    const totalIncome = (payments || [])
        .filter((p: any) => p.type !== 'waiver')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const totalExpenses = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);

    return {
        totalIncome,
        totalExpenses,
        totalBalance: totalIncome - totalExpenses
    };
});

// Query builder helper for expenses
function buildExpensesQuery(
  supabase: any,
  warehouseId: string,
  options: ExpenseQueryOptions = {}
) {
  const { category, dateFrom, dateTo, minAmount, maxAmount } = options;

  let query = supabase
    .from('expenses')
    .select('*')
    .eq('warehouse_id', warehouseId);

  if (category) {
    query = query.eq('category', category);
  }

  if (dateFrom) {
    query = query.gte('expense_date', dateFrom.toISOString());
  }

  if (dateTo) {
    query = query.lte('expense_date', dateTo.toISOString());
  }

  if (minAmount !== undefined) {
    query = query.gte('amount', minAmount);
  }

  if (maxAmount !== undefined) {
    query = query.lte('amount', maxAmount);
  }

  return query;
}

export const getExpenses = cache(async (limit = 20, offset = 0): Promise<Expense[]> => {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();
  
  if (!warehouseId) return [];

  const { data, error } = await buildExpensesQuery(supabase, warehouseId)
    .order('expense_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logError(error, { operation: 'fetch_expenses', warehouseId });
    return [];
  }

  return (data as any[]).map((e) => ({
    id: e.id,
    date: e.expense_date,
    category: e.category,
    description: e.description,
    amount: e.amount,
  }));
});
