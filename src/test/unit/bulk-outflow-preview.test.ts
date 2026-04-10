import { describe, it, expect } from 'vitest';

/**
 * Unit Tests - Bulk Outflow Preview Logic
 * Tests the client-side preview computation: FIFO allocation,
 * manual overrides, record exclusion, and summary calculations.
 * Extracted from bulk-outflow-dialog.tsx previewPlan useMemo.
 */

type MockRecord = {
  id: string;
  commodityDescription: string;
  bagsStored: number;
  storageStartDate: Date;
  storageEndDate: Date | null;
  hamaliPayable: number;
  payments: { amount: number; type: string }[];
  location: string;
};

type PreviewOperation = {
  record: MockRecord;
  take: number;
  rent: number;
  isClosing: boolean;
};

// Simplified rent calc for testing (actual uses BillingService)
function mockCalculateRent(_record: MockRecord, _date: Date, bags: number): number {
  return bags * 36; // ₹36 per bag (simplified)
}

// Core preview logic extracted from the dialog
function computePreviewPlan(
  records: MockRecord[],
  commodity: string,
  targetBags: number,
  withdrawalDate: Date,
  excludedRecordIds: Set<string>,
  manualOverrides: Record<string, number>
) {
  const activeRecords = records
    .filter(r =>
      r.commodityDescription === commodity &&
      !r.storageEndDate &&
      r.bagsStored > 0 &&
      !excludedRecordIds.has(r.id)
    )
    .sort((a, b) => a.storageStartDate.getTime() - b.storageStartDate.getTime());

  const hasOverrides = Object.keys(manualOverrides).length > 0;
  let remaining = targetBags;
  const operations: PreviewOperation[] = [];
  let totalHamaliPending = 0;

  for (const r of activeRecords) {
    let take: number;
    if (hasOverrides && manualOverrides[r.id] !== undefined) {
      take = Math.min(manualOverrides[r.id]!, r.bagsStored);
    } else if (hasOverrides) {
      take = 0;
    } else {
      if (remaining <= 0) { take = 0; } else {
        take = Math.min(r.bagsStored, remaining);
        remaining -= take;
      }
    }

    if (take <= 0) continue;

    const rent = mockCalculateRent(r, withdrawalDate, take);
    const amountPaid = r.payments.reduce((acc, p) => acc + p.amount, 0);
    const pending = r.hamaliPayable - amountPaid;
    if (pending > 0) totalHamaliPending += pending;

    operations.push({
      record: r,
      take,
      rent,
      isClosing: take === r.bagsStored,
    });
  }

  const totalAllocated = operations.reduce((sum, p) => sum + p.take, 0);

  return {
    operations,
    totalRent: operations.reduce((sum, p) => sum + p.rent, 0),
    totalHamaliPending,
    impossible: hasOverrides ? false : remaining > 0,
    totalAllocated,
  };
}

// Test data factory
function makeRecord(id: string, bags: number, date: string, commodity = 'Paddy(knl)', overrides: Partial<MockRecord> = {}): MockRecord {
  return {
    id,
    commodityDescription: commodity,
    bagsStored: bags,
    storageStartDate: new Date(date),
    storageEndDate: null,
    hamaliPayable: 0,
    payments: [],
    location: 'C2',
    ...overrides,
  };
}

const date = new Date('2026-04-10');

describe('Bulk Outflow Preview Logic', () => {
  describe('FIFO allocation (default)', () => {
    const records = [
      makeRecord('rec-1', 100, '2026-01-01'),
      makeRecord('rec-2', 100, '2026-02-01'),
      makeRecord('rec-3', 100, '2026-03-01'),
    ];

    it('allocates from oldest record first', () => {
      const plan = computePreviewPlan(records, 'Paddy(knl)', 150, date, new Set(), {});
      expect(plan.operations).toHaveLength(2);
      expect(plan.operations[0]!.record.id).toBe('rec-1');
      expect(plan.operations[0]!.take).toBe(100);
      expect(plan.operations[1]!.record.id).toBe('rec-2');
      expect(plan.operations[1]!.take).toBe(50);
    });

    it('marks record as closing when fully withdrawn', () => {
      const plan = computePreviewPlan(records, 'Paddy(knl)', 100, date, new Set(), {});
      expect(plan.operations[0]!.isClosing).toBe(true);
    });

    it('does not mark partial withdrawal as closing', () => {
      const plan = computePreviewPlan(records, 'Paddy(knl)', 50, date, new Set(), {});
      expect(plan.operations[0]!.isClosing).toBe(false);
    });

    it('sets impossible when requesting more bags than available', () => {
      const plan = computePreviewPlan(records, 'Paddy(knl)', 500, date, new Set(), {});
      expect(plan.impossible).toBe(true);
      expect(plan.totalAllocated).toBe(300);
    });

    it('handles exact total match', () => {
      const plan = computePreviewPlan(records, 'Paddy(knl)', 300, date, new Set(), {});
      expect(plan.impossible).toBe(false);
      expect(plan.totalAllocated).toBe(300);
      expect(plan.operations).toHaveLength(3);
    });

    it('calculates total rent correctly', () => {
      const plan = computePreviewPlan(records, 'Paddy(knl)', 100, date, new Set(), {});
      expect(plan.totalRent).toBe(100 * 36); // 100 bags * ₹36
    });
  });

  describe('Manual overrides', () => {
    const records = [
      makeRecord('rec-1', 100, '2026-01-01'),
      makeRecord('rec-2', 100, '2026-02-01'),
      makeRecord('rec-3', 100, '2026-03-01'),
    ];

    it('uses override values instead of FIFO', () => {
      const overrides = { 'rec-1': 20, 'rec-3': 80 };
      const plan = computePreviewPlan(records, 'Paddy(knl)', 100, date, new Set(), overrides);
      expect(plan.operations).toHaveLength(2);
      expect(plan.operations[0]!.record.id).toBe('rec-1');
      expect(plan.operations[0]!.take).toBe(20);
      expect(plan.operations[1]!.record.id).toBe('rec-3');
      expect(plan.operations[1]!.take).toBe(80);
    });

    it('skips records not in overrides when overrides exist', () => {
      const overrides = { 'rec-2': 50 };
      const plan = computePreviewPlan(records, 'Paddy(knl)', 50, date, new Set(), overrides);
      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0]!.record.id).toBe('rec-2');
    });

    it('clamps override to available bags', () => {
      const overrides = { 'rec-1': 999 }; // more than 100 available
      const plan = computePreviewPlan(records, 'Paddy(knl)', 100, date, new Set(), overrides);
      expect(plan.operations[0]!.take).toBe(100); // clamped to bagsStored
    });

    it('never marks impossible when using overrides', () => {
      const overrides = { 'rec-1': 10 };
      const plan = computePreviewPlan(records, 'Paddy(knl)', 500, date, new Set(), overrides);
      expect(plan.impossible).toBe(false); // overrides skip the "impossible" check
      expect(plan.totalAllocated).toBe(10);
    });

    it('skips zero-bag overrides', () => {
      const overrides = { 'rec-1': 0, 'rec-2': 50 };
      const plan = computePreviewPlan(records, 'Paddy(knl)', 50, date, new Set(), overrides);
      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0]!.record.id).toBe('rec-2');
    });

    it('calculates totalAllocated from overrides', () => {
      const overrides = { 'rec-1': 30, 'rec-2': 40, 'rec-3': 50 };
      const plan = computePreviewPlan(records, 'Paddy(knl)', 120, date, new Set(), overrides);
      expect(plan.totalAllocated).toBe(120);
    });
  });

  describe('Record exclusion', () => {
    const records = [
      makeRecord('rec-1', 100, '2026-01-01'),
      makeRecord('rec-2', 100, '2026-02-01'),
      makeRecord('rec-3', 100, '2026-03-01'),
    ];

    it('skips excluded records in FIFO', () => {
      const excluded = new Set(['rec-1']);
      const plan = computePreviewPlan(records, 'Paddy(knl)', 150, date, excluded, {});
      expect(plan.operations[0]!.record.id).toBe('rec-2');
      expect(plan.operations[1]!.record.id).toBe('rec-3');
    });

    it('reduces available bags when records excluded', () => {
      const excluded = new Set(['rec-1', 'rec-2']);
      const plan = computePreviewPlan(records, 'Paddy(knl)', 150, date, excluded, {});
      expect(plan.impossible).toBe(true);
      expect(plan.totalAllocated).toBe(100);
    });

    it('handles all records excluded', () => {
      const excluded = new Set(['rec-1', 'rec-2', 'rec-3']);
      const plan = computePreviewPlan(records, 'Paddy(knl)', 50, date, excluded, {});
      expect(plan.operations).toHaveLength(0);
      expect(plan.impossible).toBe(true);
    });
  });

  describe('Commodity filtering', () => {
    const records = [
      makeRecord('rec-1', 100, '2026-01-01', 'Paddy(knl)'),
      makeRecord('rec-2', 100, '2026-02-01', 'Paddy(ndl)'),
      makeRecord('rec-3', 100, '2026-03-01', 'Paddy(knl)'),
    ];

    it('only allocates from matching commodity', () => {
      const plan = computePreviewPlan(records, 'Paddy(knl)', 200, date, new Set(), {});
      expect(plan.operations).toHaveLength(2);
      expect(plan.operations.every(op => op.record.commodityDescription === 'Paddy(knl)')).toBe(true);
    });

    it('ignores different commodity entirely', () => {
      const plan = computePreviewPlan(records, 'Wheat', 50, date, new Set(), {});
      expect(plan.operations).toHaveLength(0);
      expect(plan.impossible).toBe(true);
    });
  });

  describe('Closed records filtering', () => {
    it('skips records with storageEndDate set', () => {
      const records = [
        makeRecord('rec-1', 100, '2026-01-01', 'Paddy(knl)', {
          storageEndDate: new Date('2026-03-01'),
        }),
        makeRecord('rec-2', 100, '2026-02-01'),
      ];
      const plan = computePreviewPlan(records, 'Paddy(knl)', 50, date, new Set(), {});
      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0]!.record.id).toBe('rec-2');
    });

    it('skips records with zero bags', () => {
      const records = [
        makeRecord('rec-1', 0, '2026-01-01'),
        makeRecord('rec-2', 100, '2026-02-01'),
      ];
      const plan = computePreviewPlan(records, 'Paddy(knl)', 50, date, new Set(), {});
      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0]!.record.id).toBe('rec-2');
    });
  });

  describe('Hamali tracking', () => {
    it('accumulates pending hamali from affected records', () => {
      const records = [
        makeRecord('rec-1', 100, '2026-01-01', 'Paddy(knl)', {
          hamaliPayable: 500,
          payments: [{ amount: 200, type: 'hamali' }],
        }),
        makeRecord('rec-2', 100, '2026-02-01', 'Paddy(knl)', {
          hamaliPayable: 300,
          payments: [],
        }),
      ];
      const plan = computePreviewPlan(records, 'Paddy(knl)', 200, date, new Set(), {});
      // rec-1: 500 - 200 = 300 pending, rec-2: 300 - 0 = 300 pending
      expect(plan.totalHamaliPending).toBe(600);
    });

    it('ignores hamali when fully paid', () => {
      const records = [
        makeRecord('rec-1', 100, '2026-01-01', 'Paddy(knl)', {
          hamaliPayable: 500,
          payments: [{ amount: 600, type: 'hamali' }],
        }),
      ];
      const plan = computePreviewPlan(records, 'Paddy(knl)', 50, date, new Set(), {});
      expect(plan.totalHamaliPending).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('handles empty records array', () => {
      const plan = computePreviewPlan([], 'Paddy(knl)', 50, date, new Set(), {});
      expect(plan.operations).toHaveLength(0);
      expect(plan.totalAllocated).toBe(0);
    });

    it('handles zero target bags', () => {
      const records = [makeRecord('rec-1', 100, '2026-01-01')];
      const plan = computePreviewPlan(records, 'Paddy(knl)', 0, date, new Set(), {});
      expect(plan.operations).toHaveLength(0);
      expect(plan.impossible).toBe(false);
    });

    it('handles single record exact withdrawal', () => {
      const records = [makeRecord('rec-1', 50, '2026-01-01')];
      const plan = computePreviewPlan(records, 'Paddy(knl)', 50, date, new Set(), {});
      expect(plan.totalAllocated).toBe(50);
      expect(plan.operations[0]!.isClosing).toBe(true);
      expect(plan.impossible).toBe(false);
    });
  });
});
