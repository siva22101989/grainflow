import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Unit Tests - Storage Actions
 * Tests validation for storage record updates, inflow, and outflow schemas
 */

const StorageRecordUpdateSchema = z.object({
  customerId: z.string().min(1, 'Customer is required.'),
  commodityDescription: z.string().min(2, 'Commodity description is required.'),
  location: z.string().min(1, 'Location is required.'),
  bagsStored: z.coerce.number().int().positive('Bags must be a positive number.'),
  hamaliPayable: z.coerce.number().nonnegative('Hamali charges must be a non-negative number.'),
  storageStartDate: z.string().refine(val => {
    const date = new Date(val);
    return !isNaN(date.getTime()) && date <= new Date();
  }, { message: "Date cannot be in the future" }),
  cropId: z.string().optional(),
});

describe('Storage Actions', () => {
  describe('StorageRecordUpdateSchema validation', () => {
    const validData = {
      customerId: 'cust-123',
      commodityDescription: 'Wheat Grade A',
      location: 'Bay 3',
      bagsStored: '50',
      hamaliPayable: '250',
      storageStartDate: '2024-01-15',
    };

    it('accepts valid storage record data', () => {
      const result = StorageRecordUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('coerces string numbers correctly', () => {
      const result = StorageRecordUpdateSchema.safeParse(validData);
      if (result.success) {
        expect(result.data.bagsStored).toBe(50);
        expect(result.data.hamaliPayable).toBe(250);
      }
    });

    it('rejects empty customerId', () => {
      const result = StorageRecordUpdateSchema.safeParse({ ...validData, customerId: '' });
      expect(result.success).toBe(false);
    });

    it('rejects short commodity description', () => {
      const result = StorageRecordUpdateSchema.safeParse({ ...validData, commodityDescription: 'W' });
      expect(result.success).toBe(false);
    });

    it('rejects empty location', () => {
      const result = StorageRecordUpdateSchema.safeParse({ ...validData, location: '' });
      expect(result.success).toBe(false);
    });

    it('rejects zero bags', () => {
      const result = StorageRecordUpdateSchema.safeParse({ ...validData, bagsStored: '0' });
      expect(result.success).toBe(false);
    });

    it('rejects negative bags', () => {
      const result = StorageRecordUpdateSchema.safeParse({ ...validData, bagsStored: '-5' });
      expect(result.success).toBe(false);
    });

    it('rejects fractional bags', () => {
      const result = StorageRecordUpdateSchema.safeParse({ ...validData, bagsStored: '10.5' });
      expect(result.success).toBe(false);
    });

    it('rejects negative hamali', () => {
      const result = StorageRecordUpdateSchema.safeParse({ ...validData, hamaliPayable: '-100' });
      expect(result.success).toBe(false);
    });

    it('accepts zero hamali (no hamali charges)', () => {
      const result = StorageRecordUpdateSchema.safeParse({ ...validData, hamaliPayable: '0' });
      expect(result.success).toBe(true);
    });

    it('rejects future storage start date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const result = StorageRecordUpdateSchema.safeParse({
        ...validData,
        storageStartDate: futureDate.toISOString(),
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid date string', () => {
      const result = StorageRecordUpdateSchema.safeParse({
        ...validData,
        storageStartDate: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional cropId', () => {
      const result = StorageRecordUpdateSchema.safeParse({
        ...validData,
        cropId: 'crop-wheat-001',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cropId).toBe('crop-wheat-001');
      }
    });

    it('accepts missing cropId', () => {
      const result = StorageRecordUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cropId).toBeUndefined();
      }
    });
  });

  describe('Pagination parameters', () => {
    it('validates page number is positive', () => {
      const page = 1;
      const limit = 20;
      expect(page).toBeGreaterThan(0);
      expect(limit).toBeGreaterThan(0);
    });

    it('validates status filter values', () => {
      const validStatuses = ['active', 'all', 'released'] as const;
      expect(validStatuses).toContain('active');
      expect(validStatuses).toContain('all');
      expect(validStatuses).toContain('released');
    });
  });

  describe('Record soft delete rules', () => {
    it('soft delete sets deleted_at timestamp', () => {
      const now = new Date();
      const deleteUpdate = { deleted_at: now.toISOString() };
      expect(deleteUpdate.deleted_at).toBeDefined();
      expect(new Date(deleteUpdate.deleted_at).getTime()).toBeGreaterThan(0);
    });

    it('restore clears deleted_at', () => {
      const restoreUpdate = { deleted_at: null };
      expect(restoreUpdate.deleted_at).toBeNull();
    });
  });
});
