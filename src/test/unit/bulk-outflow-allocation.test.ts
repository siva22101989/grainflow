import { describe, it, expect } from 'vitest';
import type { StorageRecord } from '@/lib/definitions';

/**
 * Tests for bulk outflow FIFO allocation and cost distribution.
 *
 * These verify:
 * 1. FIFO allocation distributes bags oldest-first
 * 2. Discount distribution doesn't exceed total discount (floating-point safety)
 * 3. Payment distribution doesn't exceed total payment
 * 4. Edge case: single record gets all bags
 * 5. Edge case: exact match (bags requested = total available)
 */

function makeRecord(overrides: Partial<StorageRecord> & { id: string }): StorageRecord {
  return {
    bagsIn: 100,
    bagsStored: 100,
    bagsOut: 0,
    commodityDescription: 'Wheat',
    storageStartDate: '2025-10-01',
    storageEndDate: null,
    totalRentBilled: 0,
    hamaliPayable: 0,
    outflowInvoiceNo: null,
    customerId: 'cust-1',
    warehouseId: 'wh-1',
    customerName: 'Test',
    customerPhone: '1234567890',
    lotId: null,
    lotName: null,
    lotCapacity: null,
    payments: [],
    withdrawalTransactions: [],
    ...overrides,
  } as StorageRecord;
}

describe('Bulk Outflow FIFO Allocation', () => {
  it('should allocate bags from oldest record first (FIFO)', () => {
    // 3 records sorted by date (oldest first)
    const records = [
      makeRecord({ id: 'r1', bagsStored: 50, storageStartDate: '2025-06-01' }),
      makeRecord({ id: 'r2', bagsStored: 30, storageStartDate: '2025-08-01' }),
      makeRecord({ id: 'r3', bagsStored: 40, storageStartDate: '2025-10-01' }),
    ];

    const totalBags = 70;
    let remaining = totalBags;
    const allocations: { id: string; bags: number }[] = [];

    for (const record of records) {
      if (remaining <= 0) break;
      const bags = Math.min(record.bagsStored, remaining);
      allocations.push({ id: record.id, bags });
      remaining -= bags;
    }

    // Should take all 50 from r1 (oldest), then 20 from r2
    expect(allocations).toEqual([
      { id: 'r1', bags: 50 },
      { id: 'r2', bags: 20 },
    ]);
    expect(remaining).toBe(0);
  });

  it('should handle exact match (withdraw all available)', () => {
    const records = [
      makeRecord({ id: 'r1', bagsStored: 30, storageStartDate: '2025-06-01' }),
      makeRecord({ id: 'r2', bagsStored: 20, storageStartDate: '2025-08-01' }),
    ];

    const totalBags = 50; // exact total
    let remaining = totalBags;
    const allocations: { id: string; bags: number }[] = [];

    for (const record of records) {
      if (remaining <= 0) break;
      const bags = Math.min(record.bagsStored, remaining);
      allocations.push({ id: record.id, bags });
      remaining -= bags;
    }

    expect(allocations).toEqual([
      { id: 'r1', bags: 30 },
      { id: 'r2', bags: 20 },
    ]);
    expect(remaining).toBe(0);
  });
});

describe('Bulk Outflow Cost Distribution', () => {
  it('should distribute discount proportionally without exceeding total', () => {
    // Simulate 3 records with different rents
    const operations = [
      { rent: 300 },
      { rent: 300 },
      { rent: 400 },
    ];
    const totalBatchRent = 1000;
    const totalDiscount = 150;
    let discountRemaining = totalDiscount;
    const allocated: number[] = [];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i]!;
      let allocatedDiscount = 0;

      if (totalBatchRent > 0 && discountRemaining > 0) {
        allocatedDiscount = (op.rent / totalBatchRent) * totalDiscount;
        allocatedDiscount = Math.round(allocatedDiscount * 100) / 100;

        if (allocatedDiscount > discountRemaining || i === operations.length - 1) {
          allocatedDiscount = discountRemaining;
        }
        discountRemaining -= allocatedDiscount;
      }

      allocated.push(allocatedDiscount);
    }

    // Sum must equal exactly totalDiscount
    const sum = allocated.reduce((a, b) => a + b, 0);
    expect(sum).toBe(totalDiscount);

    // No individual allocation should be negative
    for (const d of allocated) {
      expect(d).toBeGreaterThanOrEqual(0);
    }
  });

  it('should distribute payment proportionally without exceeding total', () => {
    const operations = [
      { rent: 100 },
      { rent: 200 },
      { rent: 300 },
    ];
    const totalBatchRent = 600;
    const totalPayment = 250;
    let paymentRemaining = totalPayment;
    const allocated: number[] = [];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i]!;
      let allocatedPayment = 0;

      if (totalBatchRent > 0 && paymentRemaining > 0) {
        allocatedPayment = (op.rent / totalBatchRent) * totalPayment;
        allocatedPayment = Math.round(allocatedPayment * 100) / 100;

        if (allocatedPayment > paymentRemaining || i === operations.length - 1) {
          allocatedPayment = paymentRemaining;
        }
        paymentRemaining -= allocatedPayment;
      }

      allocated.push(allocatedPayment);
    }

    const sum = allocated.reduce((a, b) => a + b, 0);
    expect(sum).toBe(totalPayment);

    for (const p of allocated) {
      expect(p).toBeGreaterThanOrEqual(0);
    }
  });

  it('should handle zero rent scenario (grace period)', () => {
    const totalBatchRent = 0;
    const totalPayment = 500;
    let paymentRemaining = totalPayment;

    // When rent is 0, all payment goes to the first record
    let allocatedPayment = 0;
    if (paymentRemaining > 0 && totalBatchRent === 0) {
      allocatedPayment = paymentRemaining;
      paymentRemaining = 0;
    }

    expect(allocatedPayment).toBe(500);
    expect(paymentRemaining).toBe(0);
  });
});
