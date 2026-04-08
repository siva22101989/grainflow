'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { getUserWarehouse } from '@/lib/queries';
import { saveExpense, updateExpense, deleteExpense } from '@/lib/data';
import { logError } from '@/lib/error-logger';
import { expenseCategories } from '@/lib/definitions';
import { FormState } from './common';

const ExpenseSchema = z.object({
  description: z.string().min(2, 'Description is required.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  date: z.string().refine(val => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date <= new Date();
  }, { message: "Date cannot be in the future" }),
  category: z.enum(expenseCategories, { required_error: 'Category is required.' }),
});

export async function addExpense(_prevState: FormState, formData: FormData): Promise<FormState> {
    const rawData = {
        description: formData.get('description'),
        amount: formData.get('amount'),
        date: formData.get('date'),
        category: formData.get('category'),
    };

    const validatedFields = ExpenseSchema.safeParse(rawData);

    if (!validatedFields.success) {
        const error = validatedFields.error.flatten().fieldErrors;
        const message = Object.values(error).flat().join(', ');
        return { message: `Invalid data: ${message}`, success: false, data: rawData };
    }

    const newExpense = {
        ...validatedFields.data,
        id: `EXP-${Date.now()}`,
        date: new Date(validatedFields.data.date),
    };

    try {
        await saveExpense(newExpense);
        revalidatePath('/expenses');
        return { message: 'Expense added successfully.', success: true };
    } catch (error: any) {
        logError(error, { operation: 'addExpense', metadata: { amount: rawData.amount } });
        return { message: `Failed to add expense: ${error.message}`, success: false, data: rawData };
    }
}

export async function updateExpenseAction(expenseId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const validatedFields = ExpenseSchema.safeParse({
    description: formData.get('description'),
    amount: formData.get('amount'),
    date: formData.get('date'),
    category: formData.get('category'),
  });

  if (!validatedFields.success) {
    const error = validatedFields.error.flatten().fieldErrors;
    const message = Object.values(error).flat().join(', ');
    return { message: `Invalid data: ${message}`, success: false };
  }
  
  const dataToUpdate = {
    ...validatedFields.data,
    date: new Date(validatedFields.data.date),
  };

  try {
    await updateExpense(expenseId, dataToUpdate);
    revalidatePath('/expenses');
    return { message: 'Expense updated successfully.', success: true };
  } catch (error: any) {
    logError(error, { operation: 'updateExpenseAction', metadata: { expenseId } });
    return { message: 'Failed to update expense.', success: false };
  }
}

/**
 * Delete Expense
 */
export async function deleteExpenseSimple(expenseId: string) {
  const supabase = await createClient();
  const warehouseId = await getUserWarehouse();

  if (!warehouseId) {
    return { message: 'No warehouse found for user', success: false };
  }

  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('warehouse_id', warehouseId);

  if (error) {
    logError(error, { operation: 'delete_expense', warehouseId, metadata: { expenseId } });
    return { message: 'Failed to delete expense', success: false };
  }

  revalidatePath('/expenses');
  revalidatePath('/reports');
  return { message: 'Expense deleted successfully!', success: true };
}
    

export async function deleteExpenseAction(expenseId: string): Promise<FormState> {
  try {
    await deleteExpense(expenseId);
    revalidatePath('/expenses');
    return { message: 'Expense deleted successfully.', success: true };
  } catch (error: any) {
    logError(error, { operation: 'deleteExpenseAction', metadata: { expenseId } });
    return { message: 'Failed to delete expense.', success: false };
  }
}
