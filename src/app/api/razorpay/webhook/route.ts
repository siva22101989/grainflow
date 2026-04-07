import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, processPaymentCapture } from '@/lib/services/razorpay-service';
import { textBeeService } from '@/lib/textbee';
import { logError } from '@/lib/error-logger';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // 0. Rate limit the webhook endpoint (max 100 requests per minute per IP)
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const limitResult = await rateLimit(`razorpay_webhook_${ip}`, { limit: 100, windowMs: 60000 });
    if (!limitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Get webhook signature from headers
    const signature = request.headers.get('x-razorpay-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Get raw body for signature verification
    const body = await request.text();
    const webhookData = JSON.parse(body);

    // Verify webhook signature
    const isValid = verifyWebhookSignature(body, signature);
    if (!isValid) {
      logError(new Error('Invalid webhook signature'), {
        operation: 'razorpayWebhook',
        metadata: { event: webhookData.event },
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = webhookData.event;
    const payload = webhookData.payload;

    // Handle different webhook events
    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload.payment.entity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(payload.payment.entity);
        break;

      case 'payment.authorized':
        console.log('Payment authorized:', payload.payment.entity.id);
        break;

      case 'payment_link.paid':
        // Payment link paid - the payment.captured event handles the actual processing,
        // but we update the payment link status here for completeness
        await handlePaymentLinkStatusChange(payload.payment_link.entity, 'paid');
        break;

      case 'payment_link.cancelled':
        await handlePaymentLinkStatusChange(payload.payment_link.entity, 'cancelled');
        break;

      case 'payment_link.expired':
        await handlePaymentLinkStatusChange(payload.payment_link.entity, 'expired');
        break;

      default:
        console.log('Unhandled webhook event:', event);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    logError(error, { operation: 'razorpayWebhook' });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/**
 * Handle successful payment capture
 */
async function handlePaymentCaptured(payment: any) {
  try {
    // First check if this is a subscription payment
    // Razorpay Payment Link payments include payment_link_id in the entity
    const supabase = await createClient();
    const paymentLinkId = payment.payment_link_id || payment.notes?.payment_link_id;

    let linkData = null;
    if (paymentLinkId) {
      const { data } = await supabase
        .from('payment_links')
        .select('*, metadata')
        .eq('razorpay_link_id', paymentLinkId)
        .single();
      linkData = data;
    }

    // Handle subscription payments
    if (linkData?.metadata?.subscription_payment === true) {
      await handleSubscriptionPayment(payment, linkData);
      return;
    }

    // Handle regular customer payments
    const result = await processPaymentCapture(payment);

    if (!result.success) {
      logError(new Error('Failed to process payment capture'), {
        operation: 'handlePaymentCaptured',
        metadata: { paymentId: payment.id, error: result.error },
      });
      return;
    }

    // Revalidate customer pages
    if (result.customerId) {
      revalidatePath(`/customers/${result.customerId}`);
    }
    revalidatePath('/customers');
    revalidatePath('/payments/pending');

    // Send confirmation SMS to customer
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('name, phone')
        .eq('id', result.customerId)
        .single();

      if (customer && customer.phone) {
        const businessName = process.env.RAZORPAY_BUSINESS_NAME || 'GrainFlow';
        const smsMessage = `Dear ${customer.name},\nPayment of ₹${result.amount?.toLocaleString('en-IN')} received successfully.\nThank you!\n- ${businessName}`;

        await textBeeService.sendSMS({ to: customer.phone, message: smsMessage });
      }
    } catch (smsError) {
      logError(smsError as Error, { operation: 'handlePaymentCaptured:SMS' });
      // Don't fail if SMS fails
    }

    console.log('Payment captured and processed:', payment.id);
  } catch (error) {
    logError(error as Error, { operation: 'handlePaymentCaptured', metadata: { payment } });
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(payment: any) {
  try {
    console.log('Payment failed:', payment.id, payment.error_description);

    // Optionally send retry SMS to customer
    // For now, just log the failure
    // Future: Could send "Payment failed, please try again" SMS

  } catch (error) {
    logError(error as Error, { operation: 'handlePaymentFailed' });
  }
}

/**
 * Handle subscription payment capture
 */
async function handleSubscriptionPayment(payment: any, linkData: any) {
  try {
    const { warehouse_id, plan_id } = linkData.metadata;

    // Import activation function
    const { activateSubscriptionPayment } = await import('@/lib/subscription-actions');

    // Activate subscription with payment details
    const result = await activateSubscriptionPayment(warehouse_id, plan_id, {
      razorpay_payment_id: payment.id,
      razorpay_payment_link_id: linkData.id,
      amount: payment.amount / 100, // Convert from paise to rupees
      payment_method: payment.method
    });

    if (result.success) {
      console.log('Subscription activated for warehouse:', warehouse_id);
      
      // Mark payment link as completed
      const supabase = await createClient();
      await supabase
        .from('payment_links')
        .update({ status: 'completed' })
        .eq('id', linkData.id);
    } else {
      logError(new Error('Failed to activate subscription'), {
        operation: 'handleSubscriptionPayment',
        metadata: { paymentId: payment.id, error: result.error }
      });
    }
  } catch (error) {
    logError(error as Error, {
      operation: 'handleSubscriptionPayment',
      metadata: { payment, linkData }
    });
  }
}

/**
 * Handle payment link status changes (paid, cancelled, expired)
 */
async function handlePaymentLinkStatusChange(paymentLinkEntity: any, status: string) {
  try {
    const supabase = await createClient();
    const razorpayLinkId = paymentLinkEntity.id;

    const { error } = await supabase
      .from('payment_links')
      .update({ status })
      .eq('razorpay_link_id', razorpayLinkId);

    if (error) {
      logError(error, {
        operation: 'handlePaymentLinkStatusChange',
        metadata: { razorpayLinkId, status },
      });
    }

    console.log(`Payment link ${razorpayLinkId} status changed to: ${status}`);
  } catch (error) {
    logError(error as Error, { operation: 'handlePaymentLinkStatusChange' });
  }
}
