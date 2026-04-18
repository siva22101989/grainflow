import { addMonths, isAfter, startOfDay, differenceInMonths } from 'date-fns';
import type { StorageRecord, PricingSlabConfig } from '@/lib/definitions';
import { toDate } from './utils';

import { BILLING_RATES } from '@/lib/constants';

/**
 * Validate a PricingSlabConfig for correctness.
 * Returns an error message string, or null if valid.
 */
export function validatePricingSlabs(config: PricingSlabConfig): string | null {
  if (config.min_months < 0 || !Number.isInteger(config.min_months)) {
    return 'Minimum months must be a non-negative integer.';
  }
  if (config.monthly_rate < 0) {
    return 'Monthly rate must be non-negative.';
  }

  if (config.mode === 'minimum_monthly') {
    if (config.base_rate == null || config.base_rate < 0) {
      return 'Base rate is required and must be non-negative for Minimum + Monthly mode.';
    }
  } else if (config.mode === 'slabs') {
    if (!config.slabs || config.slabs.length === 0) {
      return 'At least one slab is required for Custom Slabs mode.';
    }
    for (let i = 0; i < config.slabs.length; i++) {
      const slab = config.slabs[i];
      if (slab.up_to_months <= 0 || !Number.isInteger(slab.up_to_months)) {
        return `Slab ${i + 1}: "Up to months" must be a positive integer.`;
      }
      if (slab.rate_per_bag < 0) {
        return `Slab ${i + 1}: Rate must be non-negative.`;
      }
      if (i > 0 && slab.up_to_months <= config.slabs[i - 1].up_to_months) {
        return `Slab ${i + 1}: "Up to months" must be greater than the previous slab (${config.slabs[i - 1].up_to_months}).`;
      }
    }
  } else {
    return 'Invalid pricing mode. Must be "minimum_monthly" or "slabs".';
  }

  return null;
}

/**
 * Calculate rent using flexible pricing slabs.
 * Called internally by calculateFinalRent when pricingSlabs is provided.
 */
function calculateRentFromSlabs(
  effectiveMonths: number,
  config: PricingSlabConfig
): number {
  if (config.mode === 'minimum_monthly') {
    const baseRate = config.base_rate ?? 0;
    if (effectiveMonths <= config.min_months) {
      return baseRate;
    }
    const overflowMonths = effectiveMonths - config.min_months;
    return baseRate + overflowMonths * config.monthly_rate;
  }

  // mode === 'slabs'
  const slabs = config.slabs!;

  // Find matching slab
  for (const slab of slabs) {
    if (effectiveMonths <= slab.up_to_months) {
      return slab.rate_per_bag;
    }
  }

  // Beyond all slabs: last slab rate + overflow * monthly_rate
  const lastSlab = slabs[slabs.length - 1];
  const overflowMonths = effectiveMonths - lastSlab.up_to_months;
  return lastSlab.rate_per_bag + overflowMonths * config.monthly_rate;
}

// Rates
// Deprecated: Use BILLING_RATES from @/lib/constants
export const RATE_6_MONTHS = BILLING_RATES.SIX_MONTHS;
export const RATE_1_YEAR = BILLING_RATES.ONE_YEAR;

export type RecordStatusInfo = {
  status: string;
  nextBillingDate: Date | null;
  currentRate: number;
  alert: string | null;
};

/**
 * Determine the current status of a storage record
 * 
 * Analyzes a storage record to determine if it's active or withdrawn.
 * In this system, rent is only calculated at withdrawal time, so active
 * records don't have billing dates or current rates.
 * 
 * @param record - The storage record to analyze
 * @returns Status information including status string, billing date, rate, and alerts
 * 
 * @example
 * ```typescript
 * const record: StorageRecord = {
 *   id: '123',
 *   storageStartDate: new Date('2024-01-01'),
 *   storageEndDate: null,
 *   bagsStored: 100
 * };
 * 
 * const status = getRecordStatus(record);
 * console.log(status.status); // 'Active'
 * console.log(status.nextBillingDate); // null (rent calculated at withdrawal)
 * ```
 */
export function getRecordStatus(record: StorageRecord): RecordStatusInfo {
  const safeRecord = {
    ...record,
    storageStartDate: toDate(record.storageStartDate),
    storageEndDate: record.storageEndDate ? toDate(record.storageEndDate) : null
  };

  if (safeRecord.storageEndDate) {
    return {
      status: `Withdrawn`,
      nextBillingDate: null,
      currentRate: 0,
      alert: null,
    };
  }
  
  // Since rent is only calculated at withdrawal, the status is always simply "Active".
  // The concept of next billing date or current rate before withdrawal is not applicable.
  return {
    status: 'Active',
    nextBillingDate: null,
    currentRate: 0,
    alert: null,
  };
}


/**
 * Calculate final rent for bags being withdrawn from storage
 * 
 * Uses tiered pricing based on storage duration:
 * - 0-6 months: Uses 6-month rate
 * - 7-12 months: Uses 1-year rate  
 * - 12+ months: Multi-year calculation (1st year + additional years)
 * 
 * Month calculation rounds UP - even 1 day into new month counts as full month.
 * Minimum charge is handled by 6-month bracket.
 * 
 * @param record - The storage record being withdrawn from
 * @param withdrawalDate - Date of withdrawal
 * @param bagsToWithdraw - Number of bags to withdraw
 * @param pricing - Optional dynamic pricing override {price6m, price1y}
 * @returns Object containing rent, months stored, rent per bag, and prepaid rent (always 0 in this system)
 * 
 * @example Basic withdrawal after 3 months
 * ```typescript
 * const record = {
 *   id: '123',
 *   storageStartDate: new Date('2024-01-01'),
 *   bagsStored: 100,
 *   // ... other fields
 * };
 * 
 * const result = calculateFinalRent(
 *   record,
 *   new Date('2024-04-01'), // 3 months later
 *   50 // withdraw 50 bags
 * );
 * 
 * console.log(result.monthsStored); // 3
 * console.log(result.rentPerBag); // RATE_6_MONTHS (e.g., 50)
 * console.log(result.rent); // 50 bags × 50 = 2500
 * ```
 * 
 * @example Multi-year storage (14 months)
 * ```typescript
 * const result = calculateFinalRent(
 *   record,
 *   new Date('2025-03-01'), // 14 months later  
 *   100
 * );
 * 
 * console.log(result.monthsStored); // 14
 * console.log(result.rentPerBag); // RATE_1_YEAR + (2 × RATE_1_YEAR)
 * ```
 */
export function calculateFinalRent(
    record: StorageRecord,
    withdrawalDate: Date,
    bagsToWithdraw: number,
    pricing?: { price6m: number, price1y: number },
    pricingSlabs?: PricingSlabConfig | null
): {
    rent: number;
    monthsStored: number;
    rentPerBag: number;
    rentAlreadyPaidPerBag: number; // This will now always be 0
} {
  const startDate = startOfDay(toDate(record.storageStartDate));
  const endDate = startOfDay(withdrawalDate);

  const rentAlreadyPaidPerBag = 0; // Rent is never paid in advance.

  let rentPerBag = 0;

  // Calculate raw month difference
  let monthsStored = differenceInMonths(endDate, startDate);

  // Check if we have entered into the next month even by a day
  // differenceInMonths truncates. e.g. Jan 1 to Feb 2 is 1 month.
  // We want to know if it's strictly > X months.
  // If endDate > startDate + monthsStored, it means we are into the next month fraction.
  const exactMonthBoundary = addMonths(startDate, monthsStored);
  if (isAfter(endDate, exactMonthBoundary)) {
      monthsStored += 1;
  }

  // Minimum 1 month charge (implied by 6m bracket, but good for clarity if logic changes)
  if (monthsStored === 0 && isAfter(endDate, startDate)) {
      monthsStored = 1;
  }

  // --- Flexible slab-based pricing (new) ---
  if (pricingSlabs) {
    const effectiveMonths = Math.max(monthsStored, pricingSlabs.min_months);
    rentPerBag = effectiveMonths <= 0 ? 0 : calculateRentFromSlabs(effectiveMonths, pricingSlabs);
    const finalRentForWithdrawnBags = rentPerBag * bagsToWithdraw;
    return {
      rent: Math.max(0, finalRentForWithdrawnBags),
      monthsStored,
      rentPerBag,
      rentAlreadyPaidPerBag
    };
  }

  // --- Legacy 6m/1y pricing (existing behavior, unchanged) ---
  // Use dynamic pricing if available, else fallback to constants
  const rate6m = pricing?.price6m ?? RATE_6_MONTHS;
  const rate1y = pricing?.price1y ?? RATE_1_YEAR;

  // Handle invalid or negative duration
  if (monthsStored <= 0) {
      rentPerBag = 0;
  } else if (monthsStored <= 6) {
    rentPerBag = rate6m;
  } else if (monthsStored <= 12) {
    rentPerBag = rate1y;
  } else {
    // Multi-year logic
    // Year 1 is covered by rate1y. Subsequent years are additive.
    // Example: 13 months.
    // We treat first 12 months as Year 1 (rate1y).
    // Remaining = 1 month.

    // Total chunks of 12 months fully completed or entered
    const fullYears = Math.floor((monthsStored - 1) / 12);

    rentPerBag = fullYears * rate1y;

    const remainingMonths = monthsStored - (fullYears * 12);

    if (remainingMonths > 0) {
        if (remainingMonths <= 6) {
             rentPerBag += rate6m;
        } else {
             rentPerBag += rate1y;
        }
    }
  }

  const finalRentForWithdrawnBags = rentPerBag * bagsToWithdraw;

  return {
      rent: Math.max(0, finalRentForWithdrawnBags),
      monthsStored,
      rentPerBag,
      rentAlreadyPaidPerBag // Will be 0
  };
}

export class BillingService {
  /**
   * Calculate exact rent for a withdrawal.
   * Wrapper around `calculateFinalRent` for use within the BillingService context.
   * 
   * @param {StorageRecord} record - The storage record being withdrawn from.
   * @param {Date} withdrawalDate - The date of withdrawal.
   * @param {number} bagsToWithdraw - Number of bags being withdrawn.
   * @param {{ price6m: number, price1y: number }} [pricing] - Optional dynamic pricing config.
   * @returns {{ rent: number, monthsStored: number, rentPerBag: number, rentAlreadyPaidPerBag: number }}
   */
  static calculateRent(
    record: StorageRecord,
    withdrawalDate: Date,
    bagsToWithdraw: number,
    pricing?: { price6m: number, price1y: number },
    pricingSlabs?: PricingSlabConfig | null
  ) {
    return calculateFinalRent(record, withdrawalDate, bagsToWithdraw, pricing, pricingSlabs);
  }

  /**
   * Determine the impact of a new outflow on the storage record.
   * Calculates new bag counts, total rent, and determines if the record should be closed.
   * 
   * @param {StorageRecord} record - The existing storage record.
   * @param {number} bagsWithdrawn - The amount of bags taken in this outflow.
   * @param {number} rentAmount - The rent computed (or discounted) for this outflow.
   * @param {Date} withdrawalDate - The date of the outflow to potentially set as end date.
   * @returns {{ updates: Partial<StorageRecord>, isClosed: boolean }} The fields to update on the record, and whether it's fully closed.
   */
  static calculateOutflowImpact(
    record: StorageRecord, 
    bagsWithdrawn: number, 
    rentAmount: number, 
    withdrawalDate: Date
  ) {
    const currentBagsStored = record.bagsStored;
    const currentBagsOut = record.bagsOut || 0;
    const currentTotalRent = record.totalRentBilled || 0;

    const newBagsStored = Math.max(0, currentBagsStored - bagsWithdrawn);
    const newBagsOut = currentBagsOut + bagsWithdrawn;
    const newTotalRent = currentTotalRent + rentAmount;

    const isClosed = newBagsStored === 0;

    const updates: Partial<StorageRecord> = {
      bagsStored: newBagsStored,
      bagsOut: newBagsOut,
      totalRentBilled: newTotalRent,
    };

    if (isClosed) {
      updates.storageEndDate = withdrawalDate;
      // Do NOT set billingCycle to 'Completed'. It is strictly an Enum ('6m' | '1y').
      // The status is determined by storageEndDate being present.
    }

    return { updates, isClosed };
  }

  /**
   * Determine impact of Reverting (Deleting) an outflow transaction.
   * Restores bags to the storage record and deducts the generated rent.
   * Reopens the record if it was previously closed.
   * 
   * @param {StorageRecord} record - The current storage record state.
   * @param {number} transactionBags - The bags from the transaction being reverted.
   * @param {number} transactionRent - The rent from the transaction being reverted.
   * @returns {{ updates: Partial<StorageRecord>, shouldReopen: boolean }} Updates to apply and a flag indicating if it was reopened.
   */
  static calculateReversalImpact(
    record: StorageRecord,
    transactionBags: number,
    transactionRent: number
  ) {
    const currentBagsStored = record.bagsStored;
    const currentBagsOut = record.bagsOut || 0;
    const currentTotalRent = record.totalRentBilled || 0;

    const newBagsStored = currentBagsStored + transactionBags;
    // Ensure we don't go below zero if data is messy, but logically it should be fine
    const newBagsOut = Math.max(0, currentBagsOut - transactionBags);
    const newTotalRent = Math.max(0, currentTotalRent - transactionRent);

    const updates: Partial<StorageRecord> = {
      bagsStored: newBagsStored,
      bagsOut: newBagsOut,
      totalRentBilled: newTotalRent,
    };

    // If we restored bags, record calls for Re-opening
    const shouldReopen = record.storageEndDate !== null && newBagsStored > 0;
    if (shouldReopen) {
      updates.storageEndDate = null;
      // If we are reopening, we default to standard 6m if not set, 
      // but usually we just keep existing cycle.
      // If we must set it, use valid ENUM '6m'.
      updates.billingCycle = '6m'; 
    }

    return { updates, shouldReopen };
  }

  /**
   * Determine impact of Updating an existing outflow transaction.
   * Validates if there's enough stock for increased withdrawals.
   * 
   * @param {StorageRecord} record - The current storage record.
   * @param {{ bags: number, rent: number }} oldTransaction - The previous transaction state.
   * @param {{ bags: number, rent: number, date: Date }} newTransaction - The proposed new transaction state.
   * @throws {Error} Throws if trying to increase withdrawn bags beyond currently available stock.
   * @returns {{ updates: Partial<StorageRecord> }} The fields to update on the record.
   */
  static calculateUpdateImpact(
    record: StorageRecord,
    oldTransaction: { bags: number, rent: number },
    newTransaction: { bags: number, rent: number, date: Date }
  ) {
    const bagsDiff = newTransaction.bags - oldTransaction.bags;
    const rentDiff = newTransaction.rent - oldTransaction.rent;

    // Validation: Check simplified specific check
    // Logic: If withdrawing MORE (bagsDiff > 0), need stock.
    if (bagsDiff > 0 && record.bagsStored < bagsDiff) {
       throw new Error(`Cannot increase withdrawal by ${bagsDiff} bags. Only ${record.bagsStored} bags available.`);
    }

    const currentBagsStored = record.bagsStored;
    const currentBagsOut = record.bagsOut || 0;
    const currentTotalRent = record.totalRentBilled || 0;

    const updates: Partial<StorageRecord> = {
        bagsStored: currentBagsStored - bagsDiff,
        bagsOut: currentBagsOut + bagsDiff,
        totalRentBilled: Math.max(0, currentTotalRent + rentDiff)
    };

    // Status Check
    if (updates.bagsStored === 0) {
        updates.storageEndDate = newTransaction.date;
        // Do not set billingCycle to 'Completed'
    } else {
        // Functionally open
        if (record.storageEndDate) {
            updates.storageEndDate = null;
            updates.billingCycle = '6m';
        }
    }

    return { updates };
  }

  /**
   * FIFO Allocation: Allocate a bulk payment to oldest/selected records first.
   * Iterates through a given list of records sequentially and deducts from the totalAmount.
   * 
   * @param {{ id: string; recordNumber: string; totalDue: number }[]} records - An ordered list of records with their current total dues.
   * @param {number} totalAmount - The total payment amount (or discount amount) to distribute.
   * @returns {{ allocations: { recordId: string; recordNumber: string; amount: number; remainingDue: number }[], unallocated: number }} Array of how much was assigned to each, plus any leftover unallocated amount.
   */
  static allocatePaymentFIFO(records: { id: string; recordNumber: string; totalDue: number }[], totalAmount: number) {
      const allocations: { recordId: string; recordNumber: string; amount: number; remainingDue: number }[] = [];
      let remaining = totalAmount;
  
      for (const record of records) {
          if (remaining <= 0) {
              allocations.push({
                  recordId: record.id,
                  recordNumber: record.recordNumber,
                  amount: 0,
                  remainingDue: record.totalDue
              });
              continue;
          }
  
          const allocated = Math.min(remaining, record.totalDue);
          allocations.push({
              recordId: record.id,
              recordNumber: record.recordNumber,
              amount: allocated,
              remainingDue: record.totalDue - allocated
          });
          remaining -= allocated;
      }
  
      return { allocations, unallocated: remaining };
  }
}
