/**
 * Common query options and types for database queries
 */

/**
 * Storage record query options
 */
export interface StorageQueryOptions {
  activeOnly?: boolean;
  customerId?: string;
  includePayments?: boolean;
  includeCustomer?: boolean;
}

/**
 * Customer query options
 */
export interface CustomerQueryOptions {
  search?: string;
  pendingOnly?: boolean;
  includeBalance?: boolean;
}

/**
 * Expense query options
 */
export interface ExpenseQueryOptions {
  category?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}
