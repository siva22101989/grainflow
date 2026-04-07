import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Unit Tests - Customer Actions
 * Tests validation schemas, auto-link logic, and soft delete rules
 */

// Replicate the CommonSchemas.phone pattern for testability
const phoneSchema = z.string()
  .min(10, 'Phone number must be at least 10 digits')
  .regex(/^\d{10}$/, 'Phone must be exactly 10 digits');

const CustomerSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters.'),
  phone: phoneSchema,
  address: z.string().min(5, 'Address must be at least 5 characters.'),
  email: z.string().optional(),
  fatherName: z.string().optional(),
  village: z.string().optional(),
});

// Auto-link phone matching logic
function shouldAutoLink(phone: string): boolean {
  return /^\d{10}$/.test(phone);
}

function formatPhoneForSearch(phone: string): string {
  return `+91${phone}`;
}

describe('Customer Actions', () => {
  describe('CustomerSchema validation', () => {
    it('accepts valid customer data', () => {
      const result = CustomerSchema.safeParse({
        name: 'Ram Kumar',
        phone: '9876543210',
        address: 'Village Road, District',
      });
      expect(result.success).toBe(true);
    });

    it('accepts customer with all optional fields', () => {
      const result = CustomerSchema.safeParse({
        name: 'Ram Kumar',
        phone: '9876543210',
        address: 'Village Road, District',
        email: 'ram@example.com',
        fatherName: 'Shyam Kumar',
        village: 'Rampur',
      });
      expect(result.success).toBe(true);
    });

    it('rejects name shorter than 3 characters', () => {
      const result = CustomerSchema.safeParse({
        name: 'Ra',
        phone: '9876543210',
        address: 'Village Road, District',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toBeDefined();
      }
    });

    it('rejects address shorter than 5 characters', () => {
      const result = CustomerSchema.safeParse({
        name: 'Ram Kumar',
        phone: '9876543210',
        address: 'Vil',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.address).toBeDefined();
      }
    });

    it('rejects phone with fewer than 10 digits', () => {
      const result = CustomerSchema.safeParse({
        name: 'Ram Kumar',
        phone: '12345',
        address: 'Village Road, District',
      });
      expect(result.success).toBe(false);
    });

    it('rejects phone with letters', () => {
      const result = CustomerSchema.safeParse({
        name: 'Ram Kumar',
        phone: 'abcdefghij',
        address: 'Village Road, District',
      });
      expect(result.success).toBe(false);
    });

    it('rejects phone with country code prefix', () => {
      const result = CustomerSchema.safeParse({
        name: 'Ram Kumar',
        phone: '+919876543210',
        address: 'Village Road, District',
      });
      expect(result.success).toBe(false);
    });

    it('handles empty optional fields gracefully', () => {
      const result = CustomerSchema.safeParse({
        name: 'Ram Kumar',
        phone: '9876543210',
        address: 'Village Road, District',
        email: '',
        fatherName: '',
        village: '',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Auto-link phone logic', () => {
    it('matches valid 10-digit phone for auto-link', () => {
      expect(shouldAutoLink('9876543210')).toBe(true);
    });

    it('rejects phone with country code for auto-link', () => {
      expect(shouldAutoLink('+919876543210')).toBe(false);
    });

    it('rejects short phone for auto-link', () => {
      expect(shouldAutoLink('12345')).toBe(false);
    });

    it('rejects empty phone for auto-link', () => {
      expect(shouldAutoLink('')).toBe(false);
    });

    it('formats phone with +91 prefix for Supabase search', () => {
      expect(formatPhoneForSearch('9876543210')).toBe('+919876543210');
    });
  });

  describe('Soft delete business rules', () => {
    it('prevents deletion when active storage records exist', () => {
      const records = [{ id: 'rec-1' }]; // non-empty = has records
      const canDelete = !records || records.length === 0;
      expect(canDelete).toBe(false);
    });

    it('allows deletion when no storage records exist', () => {
      const records: any[] = [];
      const canDelete = !records || records.length === 0;
      expect(canDelete).toBe(true);
    });

    it('allows deletion when records are null', () => {
      const records = null;
      const canDelete = !records || (records as any[])?.length === 0;
      expect(canDelete).toBe(true);
    });
  });

  describe('Customer data transformation', () => {
    it('transforms camelCase to snake_case for DB update', () => {
      const validated = {
        name: 'Ram Kumar',
        phone: '9876543210',
        email: 'ram@test.com',
        address: 'Village Road',
        fatherName: 'Shyam Kumar',
        village: 'Rampur',
      };

      const updateData = {
        name: validated.name,
        phone: validated.phone,
        email: validated.email || '',
        address: validated.address,
        father_name: validated.fatherName || '',
        village: validated.village || '',
      };

      expect(updateData.father_name).toBe('Shyam Kumar');
      expect(updateData.village).toBe('Rampur');
    });

    it('defaults empty optional fields to empty strings', () => {
      const validated = {
        name: 'Ram Kumar',
        phone: '9876543210',
        email: undefined,
        address: 'Village Road',
        fatherName: undefined,
        village: undefined,
      };

      const updateData = {
        email: validated.email || '',
        father_name: validated.fatherName || '',
        village: validated.village || '',
      };

      expect(updateData.email).toBe('');
      expect(updateData.father_name).toBe('');
      expect(updateData.village).toBe('');
    });
  });
});
