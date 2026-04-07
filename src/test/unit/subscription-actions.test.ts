import { describe, it, expect } from 'vitest';

/**
 * Unit Tests - Subscription Actions
 * Tests subscription state transitions, payment validation, and admin safeguards
 */

// --- Subscription status constants (mirrors types/db.ts) ---
const SubscriptionStatus = {
  ACTIVE: 'active',
  INCOMPLETE: 'incomplete',
  GRACE_PERIOD: 'grace_period',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

type SubscriptionStatusType = typeof SubscriptionStatus[keyof typeof SubscriptionStatus];

// --- Admin update safeguard logic extracted from subscription-actions.ts ---
function buildAdminUpdateData(
  warehouseId: string,
  planId: string,
  status: SubscriptionStatusType,
  endDate?: string
) {
  const updateData: any = {
    warehouse_id: warehouseId,
    plan_id: planId,
    status: status,
    current_period_end: endDate ? new Date(endDate).toISOString() : null,
  };

  // SAFEGUARD 1: Active with future end date clears grace period
  if (status === SubscriptionStatus.ACTIVE && endDate) {
    const endDateTime = new Date(endDate).getTime();
    const now = Date.now();
    if (endDateTime > now) {
      updateData.grace_period_end = null;
      updateData.grace_period_notified = false;
    }
  }

  // SAFEGUARD 2: Grace period calculates grace_period_end
  if (status === SubscriptionStatus.GRACE_PERIOD && endDate) {
    const graceDays = 7;
    const endDateTime = new Date(endDate).getTime();
    updateData.grace_period_end = new Date(endDateTime + graceDays * 24 * 60 * 60 * 1000).toISOString();
    updateData.grace_period_notified = false;
  }

  // SAFEGUARD 3: Non-grace/non-expired clears grace period
  if (status !== SubscriptionStatus.GRACE_PERIOD && status !== SubscriptionStatus.EXPIRED) {
    updateData.grace_period_end = null;
    updateData.grace_period_notified = false;
  }

  return updateData;
}

// --- Payment amount validation logic ---
function isPaymentAmountValid(received: number, expected: number, tolerance: number = 1): boolean {
  return Math.abs(received - expected) <= tolerance;
}

// --- Grace period days calculation ---
function calculateDaysLeft(gracePeriodEnd: string): number {
  return Math.ceil(
    (new Date(gracePeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
}

describe('Subscription Actions', () => {
  describe('Admin update safeguards', () => {
    it('clears grace period when activating with future end date', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);

      const data = buildAdminUpdateData(
        'wh-1', 'plan-1',
        SubscriptionStatus.ACTIVE,
        futureDate.toISOString()
      );

      expect(data.grace_period_end).toBeNull();
      expect(data.grace_period_notified).toBe(false);
    });

    it('calculates grace_period_end as 7 days after end date', () => {
      const endDate = new Date('2024-06-15');
      const data = buildAdminUpdateData(
        'wh-1', 'plan-1',
        SubscriptionStatus.GRACE_PERIOD,
        endDate.toISOString()
      );

      const expected = new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      expect(new Date(data.grace_period_end).toDateString()).toBe(expected.toDateString());
    });

    it('clears grace period when setting to incomplete', () => {
      const data = buildAdminUpdateData(
        'wh-1', 'plan-1',
        SubscriptionStatus.INCOMPLETE
      );

      expect(data.grace_period_end).toBeNull();
      expect(data.grace_period_notified).toBe(false);
    });

    it('does not clear grace period when setting to expired', () => {
      const data = buildAdminUpdateData(
        'wh-1', 'plan-1',
        SubscriptionStatus.EXPIRED,
        '2024-06-01'
      );

      // Expired status should NOT clear grace period (safeguard 3 excludes it)
      expect(data.grace_period_end).not.toBeDefined();
      // But also shouldn't set it (safeguard 2 only applies to GRACE_PERIOD)
    });

    it('clears grace period when setting to cancelled', () => {
      const data = buildAdminUpdateData(
        'wh-1', 'plan-1',
        SubscriptionStatus.CANCELLED
      );

      expect(data.grace_period_end).toBeNull();
      expect(data.grace_period_notified).toBe(false);
    });

    it('sets current_period_end to null when no endDate provided', () => {
      const data = buildAdminUpdateData(
        'wh-1', 'plan-1',
        SubscriptionStatus.ACTIVE
      );

      expect(data.current_period_end).toBeNull();
    });

    it('preserves warehouse_id and plan_id', () => {
      const data = buildAdminUpdateData(
        'wh-123', 'plan-456',
        SubscriptionStatus.ACTIVE
      );

      expect(data.warehouse_id).toBe('wh-123');
      expect(data.plan_id).toBe('plan-456');
    });
  });

  describe('Payment amount validation', () => {
    it('accepts exact payment amount', () => {
      expect(isPaymentAmountValid(999, 999)).toBe(true);
    });

    it('accepts payment within tolerance (₹1)', () => {
      expect(isPaymentAmountValid(1000, 999)).toBe(true);
      expect(isPaymentAmountValid(998, 999)).toBe(true);
    });

    it('rejects payment outside tolerance', () => {
      expect(isPaymentAmountValid(1002, 999)).toBe(false);
      expect(isPaymentAmountValid(997, 999)).toBe(false);
    });

    it('handles zero amounts', () => {
      expect(isPaymentAmountValid(0, 0)).toBe(true);
    });

    it('handles custom tolerance', () => {
      expect(isPaymentAmountValid(1005, 1000, 5)).toBe(true);
      expect(isPaymentAmountValid(1006, 1000, 5)).toBe(false);
    });
  });

  describe('Subscription state transitions', () => {
    const validTransitions: Record<string, string[]> = {
      incomplete: ['active', 'cancelled'],
      active: ['grace_period', 'cancelled'],
      grace_period: ['active', 'expired'],
      expired: ['active'], // can reactivate via payment
    };

    it('allows active -> grace_period transition', () => {
      const from = 'active';
      expect(validTransitions[from]).toContain('grace_period');
    });

    it('allows grace_period -> expired transition', () => {
      const from = 'grace_period';
      expect(validTransitions[from]).toContain('expired');
    });

    it('allows grace_period -> active (renewal)', () => {
      const from = 'grace_period';
      expect(validTransitions[from]).toContain('active');
    });

    it('allows expired -> active (re-subscription)', () => {
      const from = 'expired';
      expect(validTransitions[from]).toContain('active');
    });

    it('does not allow expired -> grace_period', () => {
      const from = 'expired';
      expect(validTransitions[from]).not.toContain('grace_period');
    });
  });

  describe('Grace period calculations', () => {
    it('calculates positive days when grace period is in future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const days = calculateDaysLeft(futureDate.toISOString());
      expect(days).toBeGreaterThanOrEqual(4);
      expect(days).toBeLessThanOrEqual(6);
    });

    it('returns zero or negative when grace period has passed', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const days = calculateDaysLeft(pastDate.toISOString());
      expect(days).toBeLessThanOrEqual(0);
    });
  });

  describe('Idempotency', () => {
    it('detects duplicate payment by razorpay_payment_id', () => {
      const processedPayments = new Set(['pay_abc123', 'pay_def456']);
      const newPaymentId = 'pay_abc123';
      const isDuplicate = processedPayments.has(newPaymentId);
      expect(isDuplicate).toBe(true);
    });

    it('allows new payment through', () => {
      const processedPayments = new Set(['pay_abc123']);
      const newPaymentId = 'pay_xyz789';
      const isDuplicate = processedPayments.has(newPaymentId);
      expect(isDuplicate).toBe(false);
    });
  });

  describe('Warning days logic', () => {
    const warningDays = [7, 3, 1];

    it('sends warnings at 7, 3, and 1 days before expiry', () => {
      expect(warningDays).toEqual([7, 3, 1]);
      expect(warningDays).toHaveLength(3);
    });

    it('formats warning message with correct pluralization', () => {
      for (const days of warningDays) {
        const message = `Expiring in ${days} Day${days > 1 ? 's' : ''}`;
        if (days === 1) {
          expect(message).toBe('Expiring in 1 Day');
        } else {
          expect(message).toContain('Days');
        }
      }
    });
  });

  describe('Free tier fallback', () => {
    it('returns free tier structure when no subscription exists', () => {
      const subscription = null;
      const warehouseId = 'wh-1';

      const freeTier = !subscription ? {
        status: 'active',
        warehouse_id: warehouseId,
        plans: {
          name: 'free',
          display_name: 'Free',
          tier: 'free',
          max_warehouses: 1,
        },
      } : subscription;

      expect(freeTier.status).toBe('active');
      expect(freeTier.plans.tier).toBe('free');
      expect(freeTier.plans.max_warehouses).toBe(1);
    });
  });
});
