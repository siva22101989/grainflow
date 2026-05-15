'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { logError } from './error-logger';
import { LIMITS } from '@/lib/feature-flags';

export type SubscriptionState = {
  success: boolean;
  message: string;
  data?: any;
};

/**
 * Get current subscription for a warehouse.
 */
export async function getSubscriptionAction(warehouseId: string) {
  // Use service directly since this is a read operation often used by components
  // But for an action we must ensure auth if it's exposed to client
  // Since this is just a wrapper, we can check auth.
  const { getSubscriptionWithUsage } = await import('@/services/subscription-service');
  // Simple auth check wrapper inline or just trust the service? Service doesn't check auth.
  // Let's use authenticatedAction for consistency if this is called from client.
  // Actually, this function seems to be used as a server action.
  
  // NOTE: authenticatedAction signature requires (user, supabase).
  // We need to return the data.
  // But this function return type was specific.
  
  // Let's keep it simple for now and just delegate to service, but adding basic auth check to match previous behavior
  const supabase = createClient();
  const { data: { user } } = await (await supabase).auth.getUser();
  if (!user) return null;
  
  const { subscription, usage } = await getSubscriptionWithUsage(warehouseId);
  
  if (!subscription) {
      // Return Free Tier structure with actual usage
      return {
          status: 'active',
          warehouse_id: warehouseId,
          plans: {
             name: 'free',
             display_name: 'Free',
             tier: 'free',
             max_warehouses: 1,
             max_storage_records: LIMITS.STORAGE_RECORDS!.limit.free,
             features: {}
          },
          usage
      } as any; // Cast to satisfy legacy return type expected by Context
  }

  return {
      ...subscription,
      usage
  };
}

import { authenticatedAction } from './safe-action';
import { SubscriptionStatus, UserRole } from '@/types/db';

export async function startSubscriptionAction(
  warehouseId: string,
  planTier: string
): Promise<SubscriptionState> {
  return authenticatedAction('startSubscriptionAction', async (_user, supabase, _userRole) => {
      // 1. Get the plan details
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('tier', planTier)
        .single();

      if (planError || !plan) {
        return { success: false, message: "Invalid plan selected." };
      }

      // Create an 'incomplete' subscription
      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
          warehouse_id: warehouseId,
          plan_id: plan.id,
          status: SubscriptionStatus.INCOMPLETE, // Signal for admin approval/payment
          updated_at: new Date().toISOString()
        }, { onConflict: 'warehouse_id' });
      
      if (subError) throw subError;

      return { 
        success: true, 
        message: "Request logged. Please contact the Super Admin to activate this plan.", 
      };
  });
}

// --- Admin Actions ---

export async function getAdminAllSubscriptions() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Auth Check
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
    if (!profile || (profile.role !== UserRole.SUPER_ADMIN && profile.role !== UserRole.OWNER)) {
        return [];
    }

    // Fetch all warehouses with their subscriptions
    // Note: Supabase returns an array for one-to-many, but usually subscriptions are 1-1 logically here.
    const { data, error } = await supabase
        .from('warehouses')
        .select(`
            id,
            name,
            location,
            subscriptions (
                id,
                status,
                current_period_end,
                plan_id,
                plans (
                    id,
                    name,
                    tier
                )
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        logError(error, { operation: 'getAdminAllSubscriptions' });
        return [];
    }

    return data.map((w: any) => ({
        warehouseId: w.id,
        warehouseName: w.name,
        location: w.location,
        // If it's an array, take the first one or find the active one.
        // Assuming 1 active sub per warehouse for simplicity
        subscription: Array.isArray(w.subscriptions) ? w.subscriptions[0] : w.subscriptions
    }));
}

export async function getAllPlans() {
    'use server';
    const supabase = await createClient();
    const { data } = await supabase.from('plans').select('*').order('created_at', { ascending: true });
    return data || [];
}

export async function updateSubscriptionAdmin(
    warehouseId: string, 
    planId: string, 
    status: SubscriptionStatus,
    endDate?: string
): Promise<SubscriptionState> {
    const supabase = await createClient();
    
    // Build update object
    const updateData: any = {
        warehouse_id: warehouseId,
        plan_id: planId,
        status: status,
        current_period_end: endDate ? new Date(endDate).toISOString() : null,
        updated_at: new Date().toISOString()
    };
    
    // SAFEGUARD 1: If admin sets status to 'active' with a future end date, clear grace period
    // This handles manual renewals during grace period
    if (status === SubscriptionStatus.ACTIVE && endDate) {
        const endDateTime = new Date(endDate).getTime();
        const now = Date.now();
        
        if (endDateTime > now) {
            // Future date = renewal, clear grace period
            updateData.grace_period_end = null;
            updateData.grace_period_notified = false;
        }
    }
    
    // SAFEGUARD 2: If admin explicitly sets status to 'grace_period', calculate grace_period_end
    if (status === SubscriptionStatus.GRACE_PERIOD && endDate) {
        const graceDays = 7;
        const endDateTime = new Date(endDate).getTime();
        updateData.grace_period_end = new Date(endDateTime + graceDays * 24 * 60 * 60 * 1000).toISOString();
        updateData.grace_period_notified = false;
    }
    
    // SAFEGUARD 3: If changing from grace_period to any other active status, clear grace period
    if (status !== SubscriptionStatus.GRACE_PERIOD && status !== SubscriptionStatus.EXPIRED) {
        updateData.grace_period_end = null;
        updateData.grace_period_notified = false;
    }
    
    // Upsert subscription
    const { error } = await supabase
        .from('subscriptions')
        .upsert(updateData, { onConflict: 'warehouse_id' });

    if (error) {
        logError(error, { operation: 'updateSubscriptionAdmin', metadata: { warehouseId, planId, status } });
        return { success: false, message: error.message };
    }

    revalidatePath('/admin');
    return { success: true, message: 'Subscription updated successfully' };
}

// --- Subscription Expiry Handling ---

/**
 * Process expired subscriptions (called by cron/edge function)
 * Transitions: active -> grace_period -> expired -> downgrade to Free
 */
export async function processExpiredSubscriptions(): Promise<{
  success: boolean;
  processed: number;
  gracePeriod: number;
  expired: number;
  downgraded: number;
  errors: string[];
}> {
  const { createAdminClient } = await import('@/utils/supabase/admin');
  const adminSupabase = createAdminClient();
  
  try {
    // Call the DB function to process expiries
    const { data, error } = await adminSupabase.rpc('auto_expire_subscriptions');
    
    if (error) {
      logError(error, { operation: 'processExpiredSubscriptions' });
      return { 
        success: false, 
        processed: 0, 
        gracePeriod: 0,
        expired: 0,
        downgraded: 0,
        errors: [error.message] 
      };
    }

    const result = Array.isArray(data) ? data[0] : data;
    const { processed_count, grace_period_count, expired_count, downgraded_count } = result || {};
    
    // Send notifications for subscriptions in grace period or newly expired
    await sendExpiryNotifications();
    
    return { 
      success: true,
      processed: processed_count || 0,
      gracePeriod: grace_period_count || 0,
      expired: expired_count || 0,
      downgraded: downgraded_count || 0,
      errors: []
    };
  } catch (error: any) {
    logError(error, { operation: 'processExpiredSubscriptions' });
    return { 
      success: false, 
      processed: 0, 
      gracePeriod: 0,
      expired: 0,
      downgraded: 0,
      errors: [error.message] 
    };
  }
}

/**
 * Send expiry notifications for subscriptions in grace period or expired
 */
async function sendExpiryNotifications(): Promise<void> {
  const { createAdminClient } = await import('@/utils/supabase/admin');
  const adminSupabase = createAdminClient();
  
  try {
    // Fetch subscriptions in grace period that haven't been notified
    const { data: gracePeriodSubs } = await adminSupabase
      .from('subscriptions')
      .select(`
        id,
        warehouse_id,
        current_period_end,
        grace_period_end,
        warehouses!inner (
          name,
          email
        )
      `)
      .eq('status', SubscriptionStatus.GRACE_PERIOD)
      .eq('grace_period_notified', false);
    
    // Send grace period notifications
    for (const sub of gracePeriodSubs || []) {
      const daysLeft = Math.ceil(
        (new Date(sub.grace_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      await adminSupabase.from('notifications').insert({
        warehouse_id: sub.warehouse_id,
        title: '⚠️ Subscription in Grace Period',
        message: `Your subscription expired on ${new Date(sub.current_period_end).toLocaleDateString()}. You have ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining to renew before your account is downgraded to the Free plan.`,
        type: 'warning',
        category: 'subscription'
      });
      
      // Mark as notified
      await adminSupabase
        .from('subscriptions')
        .update({ grace_period_notified: true })
        .eq('id', sub.id);
    }
    
    // Fetch newly expired subscriptions (just downgraded to Free)
    const { data: expiredSubs } = await adminSupabase
      .from('subscriptions')
      .select(`
        id,
        warehouse_id,
        warehouses!inner (
          name,
          email
        ),
        plans!inner (
          name,
          tier
        )
      `)
      .eq('plans.tier', 'free')
      .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes
    
    // Send downgrade notifications
    for (const sub of expiredSubs || []) {
      await adminSupabase.from('notifications').insert({
        warehouse_id: sub.warehouse_id,
        title: '📉 Subscription Downgraded',
        message: 'Your subscription has expired and been downgraded to the Free plan. Upgrade now to restore full access to premium features.',
        type: 'error',
        category: 'subscription'
      });
    }
  } catch (error: any) {
    logError(error, { operation: 'sendExpiryNotifications' });
  }
}

/**
 * Check upcoming expiries and send proactive warnings
 * Should be called daily by cron job
 */
export async function sendExpiryWarnings(): Promise<{
  success: boolean;
  warningsSent: number;
  errors: string[];
}> {
  const { createAdminClient } = await import('@/utils/supabase/admin');
  const adminSupabase = createAdminClient();
  
  try {
    const warningDays = [7, 3, 1]; // Days before expiry to send warnings
    let totalWarnings = 0;
    
    for (const days of warningDays) {
      const { data: expiring, error } = await adminSupabase.rpc(
        'get_expiring_subscriptions',
        { days_ahead: days }
      );
      
      if (error) {
        logError(error, { operation: 'sendExpiryWarnings', metadata: { days } });
        continue;
      }
      
      for (const sub of expiring || []) {
        await adminSupabase.from('notifications').insert({
          warehouse_id: sub.warehouse_id,
          title: `⏰ Subscription Expiring in ${days} Day${days > 1 ? 's' : ''}`,
          message: `Your subscription will expire on ${new Date(sub.current_period_end).toLocaleDateString()}. Renew now to avoid service interruption and maintain access to all features.`,
          type: 'warning',
          category: 'subscription'
        });
        totalWarnings++;
      }
    }
    
    return { success: true, warningsSent: totalWarnings, errors: [] };
  } catch (error: any) {
    logError(error, { operation: 'sendExpiryWarnings' });
    return { success: false, warningsSent: 0, errors: [error.message] };
  }
}

// ============================================================================
// Subscription Payment Functions (Razorpay Integration)
// ============================================================================

import { createPaymentLink } from '@/lib/services/razorpay-service';
import { textBeeService } from '@/lib/textbee';
import { addDays, format } from 'date-fns';

export type SubscriptionPaymentLinkResult = {
  success: boolean;
  linkUrl?: string;
  linkId?: string;
  error?: string;
};

export type SubscriptionPayment = {
  id: string;
  amount: number;
  payment_status: string;
  payment_method?: string;
  payment_date: string;
  billing_period_start: string;
  billing_period_end: string;
  plans: {
    display_name: string;
    tier: string;
  };
};

/**
 * Create a Razorpay payment link for subscription upgrade or renewal.
 *
 * If `warehouseId` is empty/undefined, the active warehouse is resolved
 * server-side via getActiveWarehouseId() — avoids a race where the client
 * WarehouseProvider hasn't hydrated yet at click time and the user sees
 * "No active warehouse selected" even though one is clearly active in
 * settings.
 */
export async function createSubscriptionPaymentLink(
  warehouseId: string,
  planTier: string,
  isRenewal: boolean = false
): Promise<SubscriptionPaymentLinkResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Server-side fallback if the client didn't pass a warehouseId
    if (!warehouseId) {
      const { getActiveWarehouseId } = await import('@/lib/warehouse-actions');
      const resolvedId = await getActiveWarehouseId();
      if (!resolvedId) {
        return { success: false, error: 'No active warehouse. Please switch warehouses in Settings.' };
      }
      warehouseId = resolvedId;
    }

    // 1. Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('tier', planTier)
      .single();

    if (planError || !plan) {
      logError(planError || new Error('Plan not found'), { 
        operation: 'createSubscriptionPaymentLink', 
        metadata: { planTier }
      });
      return { success: false, error: 'Invalid plan selected' };
    }

    // 2. Get warehouse details
    const { data: warehouse, error: whError } = await supabase
      .from('warehouses')
      .select('name')
      .eq('id', warehouseId)
      .single();

    if (whError || !warehouse) {
      return { success: false, error: 'Warehouse not found' };
    }

    // 3. Get warehouse owner via user_warehouses join.
    // Uses admin client to bypass RLS — when a super_admin initiates the
    // upgrade on behalf of a warehouse, the owner's user_warehouses row is
    // hidden from the super_admin's RLS view and the lookup would 404.
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const adminSupabase = await createAdminClient();
    const { data: ownerLink, error: ownerError } = await adminSupabase
      .from('user_warehouses')
      .select('user_id, profiles!inner(full_name, phone)')
      .eq('warehouse_id', warehouseId)
      .eq('role', 'owner')
      .single();

    if (ownerError || !ownerLink) {
      return { success: false, error: 'Warehouse owner not found' };
    }

    const profile = (ownerLink as any).profiles;
    if (!profile?.phone) {
      return { success: false, error: 'Owner phone number not available' };
    }

    // 4. Create payment link via Razorpay service.
    // We deliberately do NOT pass customerId — the warehouse owner is a
    // profiles row, not a customers row, and payment_links.customer_id is
    // a FK to customers. SaaS subscription payment links leave it null.
    const linkResult = await createPaymentLink({
      warehouseId,
      customerName: profile.full_name || 'Warehouse Owner',
      customerPhone: profile.phone,
      amount: plan.price,
      description: `${plan.display_name} - ${isRenewal ? 'Renewal' : 'Subscription'}`,
      expiryInDays: 3, // Pay within 3 days
    });

    if (!linkResult.success || !linkResult.shortUrl) {
      return { 
        success: false, 
        error: linkResult.error || 'Failed to create payment link' 
      };
    }

    // 5. Update payment link metadata to mark it as a subscription payment
    // IMPORTANT: Merge with existing metadata to preserve customer_name, customer_phone, etc.
    if (linkResult.linkId) {
      const { data: existingLink } = await supabase
        .from('payment_links')
        .select('metadata')
        .eq('id', linkResult.linkId)
        .single();

      await supabase
        .from('payment_links')
        .update({
          metadata: {
            ...(existingLink?.metadata || {}),
            subscription_payment: true,
            plan_tier: planTier,
            plan_id: plan.id,
            is_renewal: isRenewal,
            warehouse_id: warehouseId
          }
        })
        .eq('id', linkResult.linkId);
    }

    // 6. Send SMS with payment link
    const businessName = process.env.RAZORPAY_BUSINESS_NAME || 'GrainFlow';
    const smsMessage = isRenewal
      ? `Your ${plan.display_name} subscription is expiring soon. Renew now: ${linkResult.shortUrl}\n- ${businessName}`
      : `Upgrade to ${plan.display_name} (₹${plan.price.toLocaleString('en-IN')}). Pay: ${linkResult.shortUrl}\n- ${businessName}`;

    try {
      await textBeeService.sendSMS({
        to: profile.phone,
        message: smsMessage
      });
    } catch (smsError) {
      logError(smsError as Error, { operation: 'createSubscriptionPaymentLink:SMS' });
      // Continue even if SMS fails
    }

    return {
      success: true,
      linkUrl: linkResult.shortUrl,
      linkId: linkResult.linkId
    };
  } catch (error: any) {
    logError(error, { operation: 'createSubscriptionPaymentLink' });
    return {
      success: false,
      error: error.message || 'Failed to create subscription payment link'
    };
  }
}

/**
 * Reconcile a subscription payment from the success page.
 *
 * Razorpay redirects the customer back to /payment-success after payment.
 * Normally the webhook activates the subscription within seconds, but the
 * webhook can fail (signature mismatch, event not subscribed, downtime).
 * This action checks whether the subscription was activated; if not, it
 * fetches the payment from Razorpay directly and activates it.
 *
 * Idempotent — activateSubscriptionPayment checks subscription_payments
 * for an existing row before doing anything, so calling this when the
 * webhook already ran is a safe no-op.
 */
export async function reconcileSubscriptionPayment(params: {
  razorpay_payment_id: string;
  razorpay_payment_link_id: string;
}): Promise<{ success: boolean; pending?: boolean; message?: string; error?: string }> {
  try {
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const supabase = await createAdminClient();

    // 1. Find the payment_link row by razorpay_link_id
    const { data: linkRow, error: linkErr } = await supabase
      .from('payment_links')
      .select('*')
      .eq('razorpay_link_id', params.razorpay_payment_link_id)
      .single();

    if (linkErr || !linkRow) {
      return { success: false, error: 'Payment link not found in our records.' };
    }

    const metadata = linkRow.metadata || {};
    if (!metadata.subscription_payment) {
      return { success: false, error: 'This payment link is not for a subscription.' };
    }

    // 2. If already activated (webhook ran), just confirm
    const { data: existingSubPayment } = await supabase
      .from('subscription_payments')
      .select('id')
      .eq('razorpay_payment_id', params.razorpay_payment_id)
      .maybeSingle();

    if (existingSubPayment) {
      return { success: true, message: 'Subscription is active. You can return to billing.' };
    }

    // 3. Webhook hasn't fired yet — fetch payment details from Razorpay
    // and activate manually. This is the fallback path.
    const { default: Razorpay } = await import('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const payment: any = await razorpay.payments.fetch(params.razorpay_payment_id);
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return { success: false, error: `Payment status from Razorpay: ${payment.status}` };
    }

    // 4. Activate the subscription
    const result = await activateSubscriptionPayment(
      metadata.warehouse_id,
      metadata.plan_id,
      {
        razorpay_payment_id: payment.id,
        razorpay_payment_link_id: linkRow.id,
        amount: payment.amount / 100,
        payment_method: payment.method,
      }
    );

    if (!result.success) {
      return { success: false, error: result.error || 'Activation failed.' };
    }

    // 5. Mark the payment_link row as completed so it's not retried
    await supabase
      .from('payment_links')
      .update({ status: 'completed', paid_at: new Date().toISOString() })
      .eq('id', linkRow.id);

    return { success: true, message: 'Subscription activated. (Webhook was delayed — we reconciled manually.)' };
  } catch (error: any) {
    logError(error, { operation: 'reconcileSubscriptionPayment', metadata: params });
    return { success: false, error: error.message || 'Reconciliation failed.' };
  }
}

/**
 * Activate subscription after successful payment
 * Called by webhook handler
 */
export async function activateSubscriptionPayment(
  warehouseId: string,
  planId: string,
  paymentDetails: {
    razorpay_payment_id: string;
    razorpay_payment_link_id: string;
    amount: number;
    payment_method: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const supabase = await createAdminClient();

    // 0. Idempotency Check: Verify if this payment has already been processed
    const { data: existingPayment } = await supabase
      .from('subscription_payments')
      .select('id')
      .eq('razorpay_payment_id', paymentDetails.razorpay_payment_id)
      .single();

    if (existingPayment) {
      console.log('Payment already processed (Idempotency check passed):', paymentDetails.razorpay_payment_id);
      return { success: true };
    }

    // 1. Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found');
    }

    // Validate payment amount matches plan price (±₹1 tolerance for rounding)
    const expectedAmount = plan.price;
    const tolerance = 1;
    if (Math.abs(paymentDetails.amount - expectedAmount) > tolerance) {
      logError(new Error('Payment amount mismatch'), {
        operation: 'activateSubscriptionPayment',
        metadata: { 
          expected: expectedAmount, 
          received: paymentDetails.amount,
          warehouseId,
          planId 
        }
      });
      return { success: false, error: `Payment amount ₹${paymentDetails.amount} does not match plan price ₹${expectedAmount}` };
    }

    // 2. Calculate billing period
    const now = new Date();
    const periodEnd = addDays(now, plan.duration_days || 30);

    // 3. Upsert subscription (activate it)
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        warehouse_id: warehouseId,
        plan_id: planId,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        razorpay_last_payment_id: paymentDetails.razorpay_payment_id,
        payment_method: paymentDetails.payment_method,
        next_billing_date: periodEnd.toISOString(),
        auto_renew_enabled: false, // Payment link mode
        updated_at: now.toISOString()
      }, { onConflict: 'warehouse_id' })
      .select()
      .single();

    if (subError) {
      throw subError;
    }

    // 4. Record payment in subscription_payments table
    const { error: paymentError } = await supabase
      .from('subscription_payments')
      .insert({
        subscription_id: subscription.id,
        warehouse_id: warehouseId,
        plan_id: planId,
        razorpay_payment_id: paymentDetails.razorpay_payment_id,
        razorpay_payment_link_id: paymentDetails.razorpay_payment_link_id,
        amount: paymentDetails.amount,
        payment_status: 'success',
        payment_method: paymentDetails.payment_method,
        payment_date: now.toISOString(),
        billing_period_start: now.toISOString(),
        billing_period_end: periodEnd.toISOString()
      });

    if (paymentError) {
      // Log but don't fail - subscription is already activated
      logError(paymentError, { operation: 'activateSubscriptionPayment:recordPayment' });
    }

    // 5. Send confirmation SMS
    try {
      const { data: ownerLink } = await supabase
        .from('user_warehouses')
        .select('user_id, profiles!inner(full_name, phone)')
        .eq('warehouse_id', warehouseId)
        .eq('role', 'owner')
        .single();

      if (ownerLink) {
        const profile = (ownerLink as any).profiles;

        if (profile?.phone) {
          const businessName = process.env.RAZORPAY_BUSINESS_NAME || 'GrainFlow';
          await textBeeService.sendSMS({
            to: profile.phone,
            message: `✅ ${plan.display_name} activated! Valid until ${format(periodEnd, 'dd MMM yyyy')}\n- ${businessName}`
          });
        }
      }
    } catch (smsError) {
      logError(smsError as Error, { operation: 'activateSubscriptionPayment:SMS' });
    }

    // 6. Revalidate subscription-related pages
    revalidatePath('/billing');
    revalidatePath('/settings');

    return { success: true };
  } catch (error: any) {
    logError(error, { 
      operation: 'activateSubscriptionPayment', 
      warehouseId,
      metadata: { planId }
    });
    return {
      success: false,
      error: error.message || 'Failed to activate subscription'
    };
  }
}

/**
 * Get subscription payment history for a warehouse
 */
export async function getSubscriptionPaymentHistory(
  warehouseId: string
): Promise<SubscriptionPayment[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('subscription_payments')
      .select(`
        id,
        amount,
        payment_status,
        payment_method,
        payment_date,
        billing_period_start,
        billing_period_end,
        plans (
          display_name,
          tier
        )
      `)
      .eq('warehouse_id', warehouseId)
      .order('payment_date', { ascending: false });

    if (error) {
      logError(error, { operation: 'getSubscriptionPaymentHistory', warehouseId });
      return [];
    }

    return (data || []) as any[];
  } catch (error: any) {
    logError(error, { operation: 'getSubscriptionPaymentHistory' });
    return [];
  }
}
