import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { logError, logWarning } from '@/lib/error-logger';

// Initialize Razorpay instance
function getRazorpayInstance() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials not configured');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export interface CreatePaymentLinkParams {
  warehouseId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  description: string;
  recordId?: string;
  expiryInDays?: number;
}

export interface PaymentLinkResult {
  success: boolean;
  linkId?: string;
  shortUrl?: string;
  error?: string;
}

/**
 * Create a Razorpay payment link for customer
 */
export async function createPaymentLink(
  params: CreatePaymentLinkParams
): Promise<PaymentLinkResult> {
  try {
    const razorpay = getRazorpayInstance();
    const supabase = await createClient();

    // Create payment link via Razorpay API
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (params.expiryInDays || 7));

    const linkData = {
      amount: Math.round(params.amount * 100), // Convert to paise
      currency: 'INR',
      description: params.description,
      customer: {
        name: params.customerName,
        contact: params.customerPhone.replace(/\D/g, ''), // Remove non-digits
      },
      notify: {
        sms: false, // We'll send our own SMS via TextBee
        email: false,
      },
      reminder_enable: false,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://grainflow.vercel.app'}/payment-success`,
      callback_method: 'get',
      expire_by: Math.floor(expiryDate.getTime() / 1000), // Unix timestamp
    };

    const razorpayLink = await razorpay.paymentLink.create(linkData);

    // Store payment link in database
    const { data: paymentLink, error } = await supabase
      .from('payment_links')
      .insert({
        warehouse_id: params.warehouseId,
        customer_id: params.customerId,
        record_id: params.recordId || null,
        amount: params.amount,
        description: params.description,
        razorpay_link_id: razorpayLink.id,
        short_url: razorpayLink.short_url,
        status: 'active',
        expires_at: expiryDate.toISOString(),
        metadata: {
          customer_name: params.customerName,
          customer_phone: params.customerPhone,
          razorpay_response: razorpayLink,
        },
      })
      .select()
      .single();

    if (error) {
      logError(error, { operation: 'createPaymentLink', metadata: { customerId: params.customerId } });
      return { success: false, error: 'Failed to store payment link' };
    }

    return {
      success: true,
      linkId: paymentLink.id,
      shortUrl: razorpayLink.short_url,
    };
  } catch (error: any) {
    logError(error, { operation: 'createPaymentLink', metadata: params });
    return {
      success: false,
      error: error.message || 'Failed to create payment link',
    };
  }
}

/**
 * Verify Razorpay payment signature
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new Error('Razorpay key secret not configured');
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return generatedSignature === signature;
  } catch (error) {
    logError(error as Error, { operation: 'verifyPaymentSignature' });
    return false;
  }
}

/**
 * Verify Razorpay webhook signature
 */
export function verifyWebhookSignature(
  webhookBody: string,
  webhookSignature: string
): boolean {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret === 'your_webhook_secret_here') {
      logWarning('Webhook secret not configured - rejecting webhook for security', {
        operation: 'verifyWebhookSignature',
      });
      return false;
    }

    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookBody)
      .digest('hex');

    return generatedSignature === webhookSignature;
  } catch (error) {
    logError(error as Error, { operation: 'verifyWebhookSignature' });
    return false;
  }
}

/**
 * Get payment details from Razorpay
 */
export async function getPaymentDetails(paymentId: string) {
  try {
    const razorpay = getRazorpayInstance();
    const payment = await razorpay.payments.fetch(paymentId);
    return { success: true, payment };
  } catch (error: any) {
    logError(error, { operation: 'getPaymentDetails', metadata: { paymentId } });
    return { success: false, error: error.message };
  }
}

/**
 * Process successful payment capture
 */
export async function processPaymentCapture(razorpayPayment: any) {
  try {
    const supabase = await createClient();

    // Extract payment details
    const paymentId = razorpayPayment.id;
    const amount = razorpayPayment.amount / 100; // Convert from paise to rupees
    const method = razorpayPayment.method;
    const status = razorpayPayment.status;

    // Find the payment link associated with this payment
    // Payment Link payments include payment_link_id in the entity
    const paymentLinkRzpId = razorpayPayment.payment_link_id || razorpayPayment.notes?.payment_link_id;

    if (!paymentLinkRzpId) {
      logWarning('No payment_link_id found in Razorpay payment', {
        operation: 'processPaymentCapture',
        metadata: { paymentId },
      });
      return { success: false, error: 'Payment link ID not found in payment' };
    }

    const { data: paymentLink } = await supabase
      .from('payment_links')
      .select('*')
      .eq('razorpay_link_id', paymentLinkRzpId)
      .single();

    if (!paymentLink) {
      logWarning('Payment link not found for Razorpay payment', {
        operation: 'processPaymentCapture',
        metadata: { paymentId, paymentLinkRzpId },
      });
      return { success: false, error: 'Payment link not found' };
    }

    // Check if payment already processed (idempotency)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('razorpay_payment_id', paymentId)
      .single();

    if (existingPayment) {
      logWarning('Payment already processed', {
        operation: 'processPaymentCapture',
        metadata: { paymentId },
      });
      return { success: true, message: 'Payment already processed', paymentId: existingPayment.id };
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        warehouse_id: paymentLink.warehouse_id,
        customer_id: paymentLink.customer_id,
        record_id: paymentLink.record_id,
        amount: amount,
        payment_date: new Date().toISOString(),
        type: 'other', // Online payment - can be allocated later
        notes: `Online payment - ${paymentLink.description}`,
        razorpay_payment_id: paymentId,
        razorpay_order_id: razorpayPayment.order_id || null,
        payment_method: method,
        payment_status: status,
      })
      .select()
      .single();

    if (paymentError) {
      logError(paymentError, { operation: 'processPaymentCapture:createPayment' });
      return { success: false, error: 'Failed to create payment record' };
    }

    // Update payment link status
    await supabase
      .from('payment_links')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_id: payment.id,
      })
      .eq('id', paymentLink.id);

    return {
      success: true,
      paymentId: payment.id,
      customerId: paymentLink.customer_id,
      amount,
    };
  } catch (error: any) {
    logError(error, { operation: 'processPaymentCapture', metadata: { razorpayPayment } });
    return { success: false, error: error.message };
  }
}

/**
 * Cancel/expire a payment link
 */
export async function cancelPaymentLink(linkId: string) {
  try {
    const supabase = await createClient();
    const razorpay = getRazorpayInstance();

    // Get payment link
    const { data: paymentLink, error: fetchError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', linkId)
      .single();

    if (fetchError || !paymentLink) {
      return { success: false, error: 'Payment link not found' };
    }

    // Cancel on Razorpay if still active
    if (paymentLink.status === 'active' && paymentLink.razorpay_link_id) {
      try {
        await razorpay.paymentLink.cancel(paymentLink.razorpay_link_id);
      } catch (error) {
        logWarning('Failed to cancel payment link on Razorpay', {
          operation: 'cancelPaymentLink',
        });
      }
    }

    // Update status in database
    const { error: updateError } = await supabase
      .from('payment_links')
      .update({ status: 'cancelled' })
      .eq('id', linkId);

    if (updateError) {
      return { success: false, error: 'Failed to cancel payment link' };
    }

    return { success: true };
  } catch (error: any) {
    logError(error, { operation: 'cancelPaymentLink', metadata: { linkId } });
    return { success: false, error: error.message };
  }
}
