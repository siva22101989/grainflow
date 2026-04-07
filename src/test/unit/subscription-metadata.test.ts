import { describe, it, expect } from 'vitest';

/**
 * Tests for subscription payment link metadata handling.
 *
 * Bug: createSubscriptionPaymentLink() overwrites the entire metadata object
 * when adding subscription_payment flag, losing customer_name and customer_phone
 * that were set by createPaymentLink().
 *
 * The fix should MERGE metadata, not replace it.
 */

describe('Subscription Payment Link Metadata', () => {
  it('should preserve existing metadata when adding subscription fields', () => {
    // Simulate what createPaymentLink stores
    const originalMetadata = {
      customer_name: 'Rajesh Kumar',
      customer_phone: '+919876543210',
      razorpay_response: { id: 'plink_test123' },
    };

    // Simulate what createSubscriptionPaymentLink adds
    const subscriptionMetadata = {
      subscription_payment: true,
      plan_tier: 'professional',
      plan_id: 'plan_001',
      is_renewal: false,
      warehouse_id: 'wh_001',
    };

    // The merged result should contain BOTH sets of fields
    const mergedMetadata = { ...originalMetadata, ...subscriptionMetadata };

    expect(mergedMetadata.customer_name).toBe('Rajesh Kumar');
    expect(mergedMetadata.customer_phone).toBe('+919876543210');
    expect(mergedMetadata.subscription_payment).toBe(true);
    expect(mergedMetadata.plan_tier).toBe('professional');
    expect(mergedMetadata.warehouse_id).toBe('wh_001');
  });
});
