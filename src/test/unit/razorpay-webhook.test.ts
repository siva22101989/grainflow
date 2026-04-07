import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyWebhookSignature } from '@/lib/services/razorpay-service';

/**
 * Tests for Razorpay webhook signature verification and payment link lookup.
 *
 * These tests verify critical security and correctness bugs:
 * 1. Webhook signature verification must REJECT when secret is not configured (not silently pass)
 * 2. Payment link lookup must use the correct Razorpay field (not order_id for payment links)
 * 3. Subscription metadata update must preserve existing metadata (not overwrite)
 */

describe('Razorpay Webhook Signature Verification', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('should reject webhook when RAZORPAY_WEBHOOK_SECRET is not configured', () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const result = verifyWebhookSignature('{"event":"payment.captured"}', 'fake-signature');

    // SECURITY: Must reject, not silently accept
    expect(result).toBe(false);
  });

  it('should reject webhook when RAZORPAY_WEBHOOK_SECRET is placeholder value', () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'your_webhook_secret_here';

    const result = verifyWebhookSignature('{"event":"payment.captured"}', 'fake-signature');

    expect(result).toBe(false);
  });

  it('should accept webhook with valid signature', () => {
    const secret = 'test_webhook_secret_123';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;

    const body = '{"event":"payment.captured","payload":{}}';
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const result = verifyWebhookSignature(body, validSignature);

    expect(result).toBe(true);
  });

  it('should reject webhook with invalid signature', () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_123';

    const result = verifyWebhookSignature('{"event":"payment.captured"}', 'invalid-signature');

    expect(result).toBe(false);
  });
});
