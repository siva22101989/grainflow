import { describe, it, expect } from 'vitest';
import { BillingService, calculateFinalRent, validatePricingSlabs } from '@/lib/billing';
import type { StorageRecord, PricingSlabConfig } from '@/lib/definitions';

/**
 * Unit Tests - BillingService
 * Tests the newly refactored BillingService class methods
 */

describe('BillingService', () => {
  describe('calculateOutflowImpact', () => {
    it('calculates impact for full withdrawal', () => {
      const record: Partial<StorageRecord> = {
        id: 'rec-1',
        bagsStored: 100,
        bagsOut: 0,
        totalRentBilled: 0,
      };

      const result = BillingService.calculateOutflowImpact(
        record as StorageRecord,
        100, // bags withdrawn
        3600, // rent amount
        new Date('2024-02-01')
      );

      expect(result.updates.bagsStored).toBe(0);
      expect(result.updates.bagsOut).toBe(100);
      expect(result.updates.totalRentBilled).toBe(3600);
      expect(result.updates.storageEndDate).toEqual(new Date('2024-02-01'));
      // billingCycle is no longer set to 'Completed' on closure.
      // Closure is determined by storageEndDate.
      expect(result.isClosed).toBe(true);
    });

    it('calculates impact for partial withdrawal', () => {
      const record: Partial<StorageRecord> = {
        id: 'rec-1',
        bagsStored: 100,
        bagsOut: 0,
        totalRentBilled: 0,
      };

      const result = BillingService.calculateOutflowImpact(
        record as StorageRecord,
        50, // bags withdrawn
        1800, // rent amount
        new Date('2024-02-01')
      );

      expect(result.updates.bagsStored).toBe(50);
      expect(result.updates.bagsOut).toBe(50);
      expect(result.updates.totalRentBilled).toBe(1800);
      expect(result.updates.storageEndDate).toBeUndefined(); // Not closed
      expect(result.isClosed).toBe(false);
    });

    it('accumulates rent for multiple outflows', () => {
      const record: Partial<StorageRecord> = {
        id: 'rec-1',
        bagsStored: 50,
        bagsOut: 50,
        totalRentBilled: 1800, // Previous outflow
      };

      const result = BillingService.calculateOutflowImpact(
        record as StorageRecord,
        50, // withdraw remaining
        1800, // additional rent
        new Date('2024-02-01')
      );

      expect(result.updates.totalRentBilled).toBe(3600); // 1800 + 1800
      expect(result.updates.bagsOut).toBe(100);
      expect(result.isClosed).toBe(true);
    });
  });

  describe('calculateReversalImpact', () => {
    it('reverses rent and reopens closed record', () => {
      const record: Partial<StorageRecord> = {
        id: 'rec-1',
        bagsStored: 0,
        bagsOut: 100,
        totalRentBilled: 3600,
        storageEndDate: new Date('2024-02-01'),
        billingCycle: '6m',
      };

      const result = BillingService.calculateReversalImpact(
        record as StorageRecord,
        100, // transaction bags
        3600 // transaction rent
      );

      expect(result.updates.totalRentBilled).toBe(0);
      expect(result.updates.bagsStored).toBe(100);
      expect(result.updates.bagsOut).toBe(0);
      expect(result.updates.storageEndDate).toBeNull();
      expect(result.updates.billingCycle).toBe('6m');
    });

    it('reverses partial outflow correctly', () => {
      const record: Partial<StorageRecord> = {
        id: 'rec-1',
        bagsStored: 50,
        bagsOut: 50,
        totalRentBilled: 1800,
        storageEndDate: null,
      };

      const result = BillingService.calculateReversalImpact(
        record as StorageRecord,
        50, // transaction bags
        1800 // transaction rent
      );

      expect(result.updates.totalRentBilled).toBe(0);
      expect(result.updates.bagsStored).toBe(100);
      expect(result.updates.bagsOut).toBe(0);
    });
  });

  describe('calculateUpdateImpact', () => {
    it('recalculates impact when quantity increases', () => {
      const record: Partial<StorageRecord> = {
        id: 'rec-1',
        bagsStored: 50,
        bagsOut: 50,
        totalRentBilled: 1800,
      };

      const result = BillingService.calculateUpdateImpact(
        record as StorageRecord,
        { bags: 50, rent: 1800 }, // old transaction
        { bags: 100, rent: 3600, date: new Date('2024-02-01') } // new transaction
      );

      expect(result.updates.totalRentBilled).toBe(3600);
      expect(result.updates.bagsStored).toBe(0); // 50 - (100 - 50) = 0
      expect(result.updates.bagsOut).toBe(100); // 50 + (100 - 50) = 100
    });

    it('handles quantity decrease correctly', () => {
      const record: Partial<StorageRecord> = {
        id: 'rec-1',
        bagsStored: 0,
        bagsOut: 100,
        totalRentBilled: 3600,
        storageEndDate: new Date('2024-02-01'),
        billingCycle: '6m',
      };

      const result = BillingService.calculateUpdateImpact(
        record as StorageRecord,
        { bags: 100, rent: 3600 }, // old transaction
        { bags: 50, rent: 1800, date: new Date('2024-02-01') } // new transaction
      );

      expect(result.updates.totalRentBilled).toBe(1800);
      expect(result.updates.bagsStored).toBe(50); // 0 - (50 - 100) = 50
      expect(result.updates.bagsOut).toBe(50); // 100 + (50 - 100) = 50
      expect(result.updates.storageEndDate).toBeNull(); // Reopened
      expect(result.updates.billingCycle).toBe('6m');
    });
  });

  describe('allocatePaymentFIFO', () => {
    it('allocates payment to oldest record first', () => {
      const records = [
        {
          id: 'rec-1',
          recordNumber: 'R001',
          totalDue: 1000,
          storageStartDate: new Date('2024-01-01'),
        },
        {
          id: 'rec-2',
          recordNumber: 'R002',
          totalDue: 2000,
          storageStartDate: new Date('2024-02-01'),
        },
      ];

      const result = BillingService.allocatePaymentFIFO(records, 1500);

      expect(result.allocations).toHaveLength(2);
      expect(result.allocations[0]!.amount).toBe(1000); // First record fully paid
      expect(result.allocations[0]!.remainingDue).toBe(0);
      expect(result.allocations[1]!.amount).toBe(500);  // Second record partially paid
      expect(result.allocations[1]!.remainingDue).toBe(1500);
      expect(result.unallocated).toBe(0);
    });

    it('handles payment exceeding total dues', () => {
      const records = [
        {
          id: 'rec-1',
          recordNumber: 'R001',
          totalDue: 500,
          storageStartDate: new Date('2024-01-01'),
        },
      ];

      const result = BillingService.allocatePaymentFIFO(records, 1000);

      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0]!.amount).toBe(500);
      expect(result.allocations[0]!.remainingDue).toBe(0);
      expect(result.unallocated).toBe(500); // 500 excess
    });

    it('distributes across multiple records', () => {
      const records = [
        { id: 'rec-1', recordNumber: 'R001', totalDue: 1000, storageStartDate: new Date('2024-01-01') },
        { id: 'rec-2', recordNumber: 'R002', totalDue: 1000, storageStartDate: new Date('2024-02-01') },
        { id: 'rec-3', recordNumber: 'R003', totalDue: 1000, storageStartDate: new Date('2024-03-01') },
      ];

      const result = BillingService.allocatePaymentFIFO(records, 2500);

      expect(result.allocations).toHaveLength(3);
      expect(result.allocations[0]!.amount).toBe(1000);
      expect(result.allocations[1]!.amount).toBe(1000);
      expect(result.allocations[2]!.amount).toBe(500);
      expect(result.allocations[2]!.remainingDue).toBe(500);
      expect(result.unallocated).toBe(0);
    });

    it('handles zero payment amount', () => {
      const records = [
        {
          id: 'rec-1',
          recordNumber: 'R001',
          totalDue: 1000,
          storageStartDate: new Date('2024-01-01'),
        },
      ];

      const result = BillingService.allocatePaymentFIFO(records, 0);

      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0]!.amount).toBe(0);
      expect(result.allocations[0]!.remainingDue).toBe(1000);
      expect(result.unallocated).toBe(0);
    });
  });

  // ============================================================
  // Flexible Pricing Slabs Tests
  // ============================================================

  describe('validatePricingSlabs', () => {
    it('should accept valid minimum_monthly config', () => {
      const config: PricingSlabConfig = {
        mode: 'minimum_monthly',
        min_months: 3,
        base_rate: 25,
        monthly_rate: 5,
      };
      expect(validatePricingSlabs(config)).toBeNull();
    });

    it('should accept valid slabs config', () => {
      const config: PricingSlabConfig = {
        mode: 'slabs',
        min_months: 0,
        slabs: [
          { up_to_months: 3, rate_per_bag: 25 },
          { up_to_months: 6, rate_per_bag: 36 },
          { up_to_months: 12, rate_per_bag: 55 },
        ],
        monthly_rate: 5,
      };
      expect(validatePricingSlabs(config)).toBeNull();
    });

    it('should reject minimum_monthly without base_rate', () => {
      const config: PricingSlabConfig = {
        mode: 'minimum_monthly',
        min_months: 3,
        monthly_rate: 5,
      };
      expect(validatePricingSlabs(config)).toContain('Base rate');
    });

    it('should reject slabs with non-ascending months', () => {
      const config: PricingSlabConfig = {
        mode: 'slabs',
        min_months: 0,
        slabs: [
          { up_to_months: 6, rate_per_bag: 36 },
          { up_to_months: 3, rate_per_bag: 25 },
        ],
        monthly_rate: 5,
      };
      expect(validatePricingSlabs(config)).toContain('greater than');
    });

    it('should reject empty slabs array', () => {
      const config: PricingSlabConfig = {
        mode: 'slabs',
        min_months: 0,
        slabs: [],
        monthly_rate: 5,
      };
      expect(validatePricingSlabs(config)).toContain('At least one slab');
    });

    it('should reject negative min_months', () => {
      const config: PricingSlabConfig = {
        mode: 'minimum_monthly',
        min_months: -1,
        base_rate: 25,
        monthly_rate: 5,
      };
      expect(validatePricingSlabs(config)).toContain('non-negative');
    });

    it('should reject negative monthly_rate', () => {
      const config: PricingSlabConfig = {
        mode: 'minimum_monthly',
        min_months: 3,
        base_rate: 25,
        monthly_rate: -5,
      };
      expect(validatePricingSlabs(config)).toContain('non-negative');
    });
  });

  describe('calculateFinalRent with pricingSlabs', () => {
    const makeRecord = (startDate: string): StorageRecord => ({
      id: 'test-1',
      customerId: 'cust-1',
      commodityDescription: 'Paddy',
      location: '',
      bagsIn: 100,
      bagsOut: 0,
      bagsStored: 100,
      storageStartDate: new Date(startDate),
      storageEndDate: null,
      billingCycle: '6m' as const,
      payments: [],
      hamaliPayable: 0,
      totalRentBilled: 0,
      lorryTractorNo: '',
    });

    describe('mode: minimum_monthly', () => {
      const slabs: PricingSlabConfig = {
        mode: 'minimum_monthly',
        min_months: 3,
        base_rate: 25,
        monthly_rate: 5,
      };

      it('should charge base_rate when stored less than min_months', () => {
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(record, new Date('2024-02-15'), 50, undefined, slabs);
        // 1.5 months stored -> rounds to 2, but min is 3 -> effective = 3
        expect(result.rentPerBag).toBe(25); // base_rate
        expect(result.rent).toBe(25 * 50);
      });

      it('should charge base_rate at exact min_months', () => {
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(record, new Date('2024-04-01'), 100, undefined, slabs);
        // 3 months stored, min is 3 -> base_rate
        expect(result.rentPerBag).toBe(25);
        expect(result.rent).toBe(2500);
      });

      it('should charge base_rate + overflow after min_months', () => {
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(record, new Date('2024-09-01'), 100, undefined, slabs);
        // 8 months stored, min is 3 -> overflow = 5
        // rent = 25 + 5 * 5 = 50
        expect(result.rentPerBag).toBe(50);
        expect(result.rent).toBe(5000);
      });

      it('should return monthsStored as actual duration, not effective', () => {
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(record, new Date('2024-02-01'), 10, undefined, slabs);
        expect(result.monthsStored).toBe(1); // actual stored
        expect(result.rentPerBag).toBe(25);   // charged at min 3 months = base_rate
      });
    });

    describe('mode: slabs', () => {
      const slabs: PricingSlabConfig = {
        mode: 'slabs',
        min_months: 0,
        slabs: [
          { up_to_months: 3, rate_per_bag: 25 },
          { up_to_months: 6, rate_per_bag: 36 },
          { up_to_months: 12, rate_per_bag: 55 },
        ],
        monthly_rate: 5,
      };

      it('should match first slab for short storage', () => {
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(record, new Date('2024-03-01'), 100, undefined, slabs);
        // 2 months -> within 3-month slab
        expect(result.rentPerBag).toBe(25);
        expect(result.rent).toBe(2500);
      });

      it('should match exact slab boundary', () => {
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(record, new Date('2024-07-01'), 100, undefined, slabs);
        // 6 months -> exact 6-month slab boundary
        expect(result.rentPerBag).toBe(36);
      });

      it('should match next slab when between boundaries', () => {
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(record, new Date('2024-05-15'), 100, undefined, slabs);
        // ~4.5 months -> rounds to 5 -> within 6-month slab
        expect(result.rentPerBag).toBe(36);
      });

      it('should use overflow rate beyond last slab', () => {
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(record, new Date('2025-03-01'), 100, undefined, slabs);
        // 14 months -> beyond 12-month slab
        // rent = 55 + (14 - 12) * 5 = 65
        expect(result.rentPerBag).toBe(65);
        expect(result.rent).toBe(6500);
      });

      it('should enforce min_months with slabs', () => {
        const slabsWithMin: PricingSlabConfig = {
          ...slabs,
          min_months: 3,
        };
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(record, new Date('2024-02-01'), 100, undefined, slabsWithMin);
        // 1 month stored, min 3 -> effective = 3 -> 3-month slab
        expect(result.rentPerBag).toBe(25);
        expect(result.monthsStored).toBe(1); // actual months stored
      });
    });

    describe('backward compatibility', () => {
      it('should use legacy pricing when pricingSlabs is null', () => {
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(
          record, new Date('2024-04-01'), 100,
          { price6m: 30, price1y: 50 },
          null
        );
        // 3 months -> 6m bracket -> legacy rate
        expect(result.rentPerBag).toBe(30);
      });

      it('should use legacy pricing when pricingSlabs is undefined', () => {
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(
          record, new Date('2024-04-01'), 100,
          { price6m: 30, price1y: 50 }
        );
        expect(result.rentPerBag).toBe(30);
      });

      it('should use BILLING_RATES constants when no pricing at all', () => {
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(record, new Date('2024-04-01'), 100);
        // 3 months -> 6m bracket -> BILLING_RATES.SIX_MONTHS = 36
        expect(result.rentPerBag).toBe(36);
      });

      it('should prioritize pricingSlabs over legacy pricing', () => {
        const slabs: PricingSlabConfig = {
          mode: 'minimum_monthly',
          min_months: 1,
          base_rate: 99,
          monthly_rate: 10,
        };
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(
          record, new Date('2024-04-01'), 100,
          { price6m: 30, price1y: 50 }, // this should be ignored
          slabs
        );
        // 3 months -> min 1 -> overflow = 2 -> 99 + 2*10 = 119
        expect(result.rentPerBag).toBe(119);
      });
    });

    describe('edge cases', () => {
      it('should handle same-day withdrawal with min_months', () => {
        const slabs: PricingSlabConfig = {
          mode: 'minimum_monthly',
          min_months: 3,
          base_rate: 25,
          monthly_rate: 5,
        };
        const record = makeRecord('2024-01-01');
        const result = calculateFinalRent(record, new Date('2024-01-01'), 100, undefined, slabs);
        // 0 months stored, min 3 -> effective = 3 -> base_rate
        expect(result.rentPerBag).toBe(25);
        expect(result.monthsStored).toBe(0);
      });

      it('should handle single slab config', () => {
        const slabs: PricingSlabConfig = {
          mode: 'slabs',
          min_months: 0,
          slabs: [{ up_to_months: 6, rate_per_bag: 30 }],
          monthly_rate: 4,
        };
        const record = makeRecord('2024-01-01');
        // Within slab
        expect(calculateFinalRent(record, new Date('2024-04-01'), 10, undefined, slabs).rentPerBag).toBe(30);
        // Beyond slab: 30 + 1*4 = 34
        expect(calculateFinalRent(record, new Date('2024-08-01'), 10, undefined, slabs).rentPerBag).toBe(34);
      });
    });
  });
});
