import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Unit Tests - Bulk Outflow Actions
 * Tests validation, FIFO allocation, proportional distribution, and hamali settlement
 */

// Replicate BulkOutflowSchema from actions/storage/bulk-outflow.ts
const BulkOutflowSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  commodity: z.string().min(1, 'Commodity is required'),
  totalBagsToWithdraw: z.coerce.number().int().positive('Total bags must be positive'),
  withdrawalDate: z.string().refine(val => {
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, { message: "Date cannot be in the future" }),
  finalRent: z.coerce.number().nonnegative('Final rent cannot be negative'),
  discount: z.coerce.number().nonnegative('Discount cannot be negative').optional(),
  amountPaidNow: z.coerce.number().nonnegative().optional(),
  sendSms: z.boolean().optional(),
  specificRecordIds: z.string().optional(),
});

// FIFO allocation logic extracted from processBulkOutflow
type MockRecord = {
  id: string;
  bagsStored: number;
  rent: number;
  hamaliPayable?: number;
  insurancePayable?: number;
  payments?: { type: string; amount: number }[];
};

function allocateBagsFIFO(records: MockRecord[], totalBags: number) {
  let remaining = totalBags;
  const operations = [];

  for (const record of records) {
    if (remaining <= 0) break;
    const bags = Math.min(record.bagsStored, remaining);
    operations.push({ record, bags, rent: record.rent });
    remaining -= bags;
  }

  return operations;
}

function distributeProportionally(operations: { rent: number }[], totalAmount: number) {
  const totalRent = operations.reduce((sum, op) => sum + op.rent, 0);
  let remaining = totalAmount;

  return operations.map((op, i) => {
    let allocated: number;
    if (totalRent > 0) {
      allocated = (op.rent / totalRent) * totalAmount;
      allocated = Math.round(allocated * 100) / 100;
      if (allocated > remaining || i === operations.length - 1) {
        allocated = remaining;
      }
    } else if (remaining > 0 && i === 0) {
      allocated = remaining;
    } else {
      allocated = 0;
    }
    remaining -= allocated;
    return allocated;
  });
}

function calculateHamaliDue(record: MockRecord): number {
  const hamaliPaid = (record.payments || [])
    .filter(p => p.type === 'hamali')
    .reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, (record.hamaliPayable || 0) - hamaliPaid);
}

// Mirrors STEP 5b: outstanding insurance auto-settled on record closure.
function calculateInsuranceDue(record: MockRecord): number {
  const insurancePaid = (record.payments || [])
    .filter(p => p.type === 'insurance')
    .reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, (record.insurancePayable || 0) - insurancePaid);
}

describe('Bulk Outflow Actions', () => {
  describe('BulkOutflowSchema validation', () => {
    const validData = {
      customerId: 'cust-123',
      commodity: 'Wheat',
      totalBagsToWithdraw: '50',
      withdrawalDate: '2024-01-15',
      finalRent: '5000',
    };

    it('accepts valid bulk outflow data', () => {
      const result = BulkOutflowSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('coerces string numbers to proper types', () => {
      const result = BulkOutflowSchema.safeParse(validData);
      if (result.success) {
        expect(result.data.totalBagsToWithdraw).toBe(50);
        expect(result.data.finalRent).toBe(5000);
      }
    });

    it('rejects empty customerId', () => {
      const result = BulkOutflowSchema.safeParse({ ...validData, customerId: '' });
      expect(result.success).toBe(false);
    });

    it('rejects empty commodity', () => {
      const result = BulkOutflowSchema.safeParse({ ...validData, commodity: '' });
      expect(result.success).toBe(false);
    });

    it('rejects zero bags', () => {
      const result = BulkOutflowSchema.safeParse({ ...validData, totalBagsToWithdraw: '0' });
      expect(result.success).toBe(false);
    });

    it('rejects negative bags', () => {
      const result = BulkOutflowSchema.safeParse({ ...validData, totalBagsToWithdraw: '-5' });
      expect(result.success).toBe(false);
    });

    it('rejects fractional bags', () => {
      const result = BulkOutflowSchema.safeParse({ ...validData, totalBagsToWithdraw: '10.5' });
      expect(result.success).toBe(false);
    });

    it('rejects future withdrawal date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const result = BulkOutflowSchema.safeParse({
        ...validData,
        withdrawalDate: futureDate.toISOString(),
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative rent', () => {
      const result = BulkOutflowSchema.safeParse({ ...validData, finalRent: '-100' });
      expect(result.success).toBe(false);
    });

    it('accepts zero rent (fully paid)', () => {
      const result = BulkOutflowSchema.safeParse({ ...validData, finalRent: '0' });
      expect(result.success).toBe(true);
    });

    it('accepts optional discount', () => {
      const result = BulkOutflowSchema.safeParse({ ...validData, discount: '500' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.discount).toBe(500);
      }
    });

    it('rejects negative discount', () => {
      const result = BulkOutflowSchema.safeParse({ ...validData, discount: '-100' });
      expect(result.success).toBe(false);
    });

    it('parses specificRecordIds as optional string', () => {
      const result = BulkOutflowSchema.safeParse({
        ...validData,
        specificRecordIds: 'rec-1,rec-2,rec-3',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.specificRecordIds).toBe('rec-1,rec-2,rec-3');
      }
    });
  });

  describe('FIFO bag allocation', () => {
    it('allocates all bags from single record', () => {
      const records: MockRecord[] = [
        { id: 'rec-1', bagsStored: 100, rent: 5000 },
      ];
      const ops = allocateBagsFIFO(records, 50);
      expect(ops).toHaveLength(1);
      expect(ops[0]!.bags).toBe(50);
    });

    it('allocates across multiple records FIFO', () => {
      const records: MockRecord[] = [
        { id: 'rec-1', bagsStored: 30, rent: 3000 },
        { id: 'rec-2', bagsStored: 50, rent: 5000 },
        { id: 'rec-3', bagsStored: 20, rent: 2000 },
      ];
      const ops = allocateBagsFIFO(records, 60);
      expect(ops).toHaveLength(2);
      expect(ops[0]!.bags).toBe(30); // Takes all from first
      expect(ops[1]!.bags).toBe(30); // Takes 30 from second
    });

    it('stops when all bags are allocated', () => {
      const records: MockRecord[] = [
        { id: 'rec-1', bagsStored: 100, rent: 5000 },
        { id: 'rec-2', bagsStored: 100, rent: 5000 },
      ];
      const ops = allocateBagsFIFO(records, 50);
      expect(ops).toHaveLength(1);
      expect(ops[0]!.bags).toBe(50);
    });

    it('fully drains records when withdrawing all', () => {
      const records: MockRecord[] = [
        { id: 'rec-1', bagsStored: 30, rent: 3000 },
        { id: 'rec-2', bagsStored: 20, rent: 2000 },
      ];
      const ops = allocateBagsFIFO(records, 50);
      expect(ops).toHaveLength(2);
      expect(ops[0]!.bags).toBe(30);
      expect(ops[1]!.bags).toBe(20);
    });

    it('handles zero bags to withdraw', () => {
      const records: MockRecord[] = [
        { id: 'rec-1', bagsStored: 100, rent: 5000 },
      ];
      const ops = allocateBagsFIFO(records, 0);
      expect(ops).toHaveLength(0);
    });

    it('handles empty records array', () => {
      const ops = allocateBagsFIFO([], 50);
      expect(ops).toHaveLength(0);
    });
  });

  describe('Proportional distribution', () => {
    it('distributes payment proportionally to rent', () => {
      const operations = [
        { rent: 3000 },
        { rent: 7000 },
      ];
      const allocated = distributeProportionally(operations, 5000);
      expect(allocated[0]).toBeCloseTo(1500, 0);
      expect(allocated[1]).toBeCloseTo(3500, 0);
    });

    it('handles single operation', () => {
      const operations = [{ rent: 5000 }];
      const allocated = distributeProportionally(operations, 2000);
      expect(allocated[0]).toBe(2000);
    });

    it('handles zero total rent', () => {
      const operations = [{ rent: 0 }, { rent: 0 }];
      const allocated = distributeProportionally(operations, 1000);
      // When all rents are zero, first record gets everything
      expect(allocated[0]).toBe(1000);
      expect(allocated[1]).toBe(0);
    });

    it('ensures no rounding errors lose money', () => {
      const operations = [
        { rent: 3333 },
        { rent: 3333 },
        { rent: 3334 },
      ];
      const allocated = distributeProportionally(operations, 1000);
      const total = allocated.reduce((s, a) => s + a, 0);
      expect(total).toBeCloseTo(1000, 1);
    });

    it('distributes discount proportionally', () => {
      const operations = [
        { rent: 2000 },
        { rent: 8000 },
      ];
      const allocated = distributeProportionally(operations, 500);
      expect(allocated[0]).toBeCloseTo(100, 0);
      expect(allocated[1]).toBeCloseTo(400, 0);
    });
  });

  describe('Hamali auto-settlement', () => {
    it('calculates outstanding hamali correctly', () => {
      const record: MockRecord = {
        id: 'rec-1',
        bagsStored: 0,
        rent: 0,
        hamaliPayable: 500,
        payments: [
          { type: 'hamali', amount: 200 },
        ],
      };
      expect(calculateHamaliDue(record)).toBe(300);
    });

    it('returns zero when hamali fully paid', () => {
      const record: MockRecord = {
        id: 'rec-1',
        bagsStored: 0,
        rent: 0,
        hamaliPayable: 500,
        payments: [
          { type: 'hamali', amount: 500 },
        ],
      };
      expect(calculateHamaliDue(record)).toBe(0);
    });

    it('returns zero when no hamali payable', () => {
      const record: MockRecord = {
        id: 'rec-1',
        bagsStored: 0,
        rent: 0,
        hamaliPayable: 0,
        payments: [],
      };
      expect(calculateHamaliDue(record)).toBe(0);
    });

    it('ignores non-hamali payments', () => {
      const record: MockRecord = {
        id: 'rec-1',
        bagsStored: 0,
        rent: 0,
        hamaliPayable: 500,
        payments: [
          { type: 'rent', amount: 1000 },
          { type: 'hamali', amount: 100 },
        ],
      };
      expect(calculateHamaliDue(record)).toBe(400);
    });

    it('handles missing payments array', () => {
      const record: MockRecord = {
        id: 'rec-1',
        bagsStored: 0,
        rent: 0,
        hamaliPayable: 500,
      };
      expect(calculateHamaliDue(record)).toBe(500);
    });

    it('never returns negative hamali due', () => {
      const record: MockRecord = {
        id: 'rec-1',
        bagsStored: 0,
        rent: 0,
        hamaliPayable: 200,
        payments: [
          { type: 'hamali', amount: 500 }, // overpaid
        ],
      };
      expect(calculateHamaliDue(record)).toBe(0);
    });
  });

  describe('Insurance auto-settlement', () => {
    it('calculates outstanding insurance correctly', () => {
      const record: MockRecord = {
        id: 'rec-1',
        bagsStored: 0,
        rent: 0,
        insurancePayable: 1698,
        payments: [
          { type: 'insurance', amount: 25 },
        ],
      };
      expect(calculateInsuranceDue(record)).toBe(1673);
    });

    it('returns zero when insurance fully paid', () => {
      const record: MockRecord = {
        id: 'rec-1',
        bagsStored: 0,
        rent: 0,
        insurancePayable: 1698,
        payments: [
          { type: 'insurance', amount: 1698 },
        ],
      };
      expect(calculateInsuranceDue(record)).toBe(0);
    });

    it('returns zero when no insurance payable', () => {
      const record: MockRecord = {
        id: 'rec-1',
        bagsStored: 0,
        rent: 0,
        insurancePayable: 0,
        payments: [],
      };
      expect(calculateInsuranceDue(record)).toBe(0);
    });

    it('ignores non-insurance payments (hamali payment does not settle insurance)', () => {
      const record: MockRecord = {
        id: 'rec-1',
        bagsStored: 0,
        rent: 0,
        insurancePayable: 1698,
        payments: [
          { type: 'hamali', amount: 7075 },
          { type: 'insurance', amount: 100 },
        ],
      };
      expect(calculateInsuranceDue(record)).toBe(1598);
    });

    it('handles missing payments array', () => {
      const record: MockRecord = {
        id: 'rec-1',
        bagsStored: 0,
        rent: 0,
        insurancePayable: 1698,
      };
      expect(calculateInsuranceDue(record)).toBe(1698);
    });

    it('never returns negative insurance due', () => {
      const record: MockRecord = {
        id: 'rec-1',
        bagsStored: 0,
        rent: 0,
        insurancePayable: 200,
        payments: [
          { type: 'insurance', amount: 500 }, // overpaid
        ],
      };
      expect(calculateInsuranceDue(record)).toBe(0);
    });
  });

  describe('Specific record ID parsing', () => {
    it('splits comma-separated IDs', () => {
      const input = 'rec-1,rec-2,rec-3';
      const ids = input.split(',').filter(Boolean);
      expect(ids).toEqual(['rec-1', 'rec-2', 'rec-3']);
    });

    it('handles single ID', () => {
      const input = 'rec-1';
      const ids = input.split(',').filter(Boolean);
      expect(ids).toEqual(['rec-1']);
    });

    it('filters empty strings from trailing commas', () => {
      const input = 'rec-1,rec-2,';
      const ids = input.split(',').filter(Boolean);
      expect(ids).toEqual(['rec-1', 'rec-2']);
    });

    it('returns null for empty string', () => {
      const input = '';
      const ids = input.split(',').filter(Boolean);
      const result = ids.length === 0 ? null : ids;
      expect(result).toBeNull();
    });
  });
});
