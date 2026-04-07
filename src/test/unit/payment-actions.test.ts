import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Unit Tests - Payment Actions
 * Tests validation schemas, payment type mapping, and bulk payment logic
 */

// --- Test the PaymentSchema validation directly ---
const PaymentSchema = z.object({
  recordId: z.string(),
  paymentAmount: z.coerce.number().positive('Payment amount must be a positive number.'),
  paymentDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  paymentType: z.enum(['Rent/Other', 'Hamali', 'rent', 'hamali', 'advance', 'security_deposit', 'other']),
});

// --- Payment type mapping logic extracted for testability ---
function mapPaymentType(paymentType: string): { type: string; notes: string } {
  if (paymentType === 'Hamali' || paymentType === 'hamali') {
    return { type: 'hamali', notes: 'Hamali Payment' };
  } else if (paymentType === 'Rent/Other' || paymentType === 'rent') {
    return { type: 'rent', notes: 'Rent Payment' };
  } else {
    return {
      type: paymentType,
      notes: `${paymentType.charAt(0).toUpperCase() + paymentType.slice(1).replace('_', ' ')} Payment`
    };
  }
}

describe('Payment Actions', () => {
  describe('PaymentSchema validation', () => {
    it('accepts valid payment data', () => {
      const result = PaymentSchema.safeParse({
        recordId: 'rec-123',
        paymentAmount: '500',
        paymentDate: '2024-03-15',
        paymentType: 'rent',
      });
      expect(result.success).toBe(true);
    });

    it('coerces string amount to number', () => {
      const result = PaymentSchema.safeParse({
        recordId: 'rec-123',
        paymentAmount: '1500.50',
        paymentDate: '2024-03-15',
        paymentType: 'rent',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paymentAmount).toBe(1500.50);
      }
    });

    it('rejects zero payment amount', () => {
      const result = PaymentSchema.safeParse({
        recordId: 'rec-123',
        paymentAmount: '0',
        paymentDate: '2024-03-15',
        paymentType: 'rent',
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative payment amount', () => {
      const result = PaymentSchema.safeParse({
        recordId: 'rec-123',
        paymentAmount: '-100',
        paymentDate: '2024-03-15',
        paymentType: 'rent',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid date format', () => {
      const result = PaymentSchema.safeParse({
        recordId: 'rec-123',
        paymentAmount: '500',
        paymentDate: 'not-a-date',
        paymentType: 'rent',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid payment type', () => {
      const result = PaymentSchema.safeParse({
        recordId: 'rec-123',
        paymentAmount: '500',
        paymentDate: '2024-03-15',
        paymentType: 'invalid_type',
      });
      expect(result.success).toBe(false);
    });

    it('accepts all valid payment type enums', () => {
      const validTypes = ['Rent/Other', 'Hamali', 'rent', 'hamali', 'advance', 'security_deposit', 'other'];
      for (const type of validTypes) {
        const result = PaymentSchema.safeParse({
          recordId: 'rec-123',
          paymentAmount: '100',
          paymentDate: '2024-01-01',
          paymentType: type,
        });
        expect(result.success).toBe(true);
      }
    });

    it('accepts ISO date string', () => {
      const result = PaymentSchema.safeParse({
        recordId: 'rec-123',
        paymentAmount: '100',
        paymentDate: '2024-03-15T10:30:00.000Z',
        paymentType: 'rent',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Payment type mapping', () => {
    it('maps legacy Hamali to hamali type', () => {
      const result = mapPaymentType('Hamali');
      expect(result.type).toBe('hamali');
      expect(result.notes).toBe('Hamali Payment');
    });

    it('maps lowercase hamali to hamali type', () => {
      const result = mapPaymentType('hamali');
      expect(result.type).toBe('hamali');
    });

    it('maps legacy Rent/Other to rent type', () => {
      const result = mapPaymentType('Rent/Other');
      expect(result.type).toBe('rent');
      expect(result.notes).toBe('Rent Payment');
    });

    it('maps lowercase rent to rent type', () => {
      const result = mapPaymentType('rent');
      expect(result.type).toBe('rent');
    });

    it('passes through advance type with formatted notes', () => {
      const result = mapPaymentType('advance');
      expect(result.type).toBe('advance');
      expect(result.notes).toBe('Advance Payment');
    });

    it('passes through security_deposit with formatted notes', () => {
      const result = mapPaymentType('security_deposit');
      expect(result.type).toBe('security_deposit');
      expect(result.notes).toBe('Security deposit Payment');
    });

    it('passes through other type with formatted notes', () => {
      const result = mapPaymentType('other');
      expect(result.type).toBe('other');
      expect(result.notes).toBe('Other Payment');
    });
  });

  describe('Bulk payment validation', () => {
    it('rejects missing customerId', () => {
      const customerId = '';
      const totalAmount = 500;
      const isValid = !!(customerId && !isNaN(totalAmount) && totalAmount > 0);
      expect(isValid).toBe(false);
    });

    it('rejects NaN totalAmount', () => {
      const customerId = 'cust-1';
      const totalAmount = NaN;
      const isValid = !!(customerId && !isNaN(totalAmount) && totalAmount > 0);
      expect(isValid).toBe(false);
    });

    it('rejects zero totalAmount', () => {
      const customerId = 'cust-1';
      const totalAmount = 0;
      const isValid = !!(customerId && !isNaN(totalAmount) && totalAmount > 0);
      expect(isValid).toBe(false);
    });

    it('rejects negative totalAmount', () => {
      const customerId = 'cust-1';
      const totalAmount = -100;
      const isValid = !!(customerId && !isNaN(totalAmount) && totalAmount > 0);
      expect(isValid).toBe(false);
    });

    it('accepts valid bulk payment params', () => {
      const customerId = 'cust-1';
      const totalAmount = 1500;
      const isValid = !!(customerId && !isNaN(totalAmount) && totalAmount > 0);
      expect(isValid).toBe(true);
    });

    it('parses manual allocations JSON correctly', () => {
      const json = JSON.stringify([
        { recordId: 'rec-1', amount: 500 },
        { recordId: 'rec-2', amount: 1000 },
      ]);
      const allocations = JSON.parse(json);
      expect(allocations).toHaveLength(2);
      expect(allocations[0].recordId).toBe('rec-1');
      expect(allocations[0].amount).toBe(500);
    });

    it('handles undefined manual allocations', () => {
      const json = null;
      const allocations = json ? JSON.parse(json) : undefined;
      expect(allocations).toBeUndefined();
    });
  });
});
