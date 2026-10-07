import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createSubscriptionPaymentLink } from '@/lib/subscription-actions';
import { logError } from '@/lib/error-logger';
import { Logger } from '@/lib/logger';

/**
 * Subscription Renewal Endpoint
 * Called by Supabase pg_cron or manually for testing
 * 
 * Auth: Bearer token from CRON_SECRET env var
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      logError(new Error('CRON_SECRET not configured'), {
        operation: 'cron.subscriptionRenewal',
      });
      return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createAdminClient();

    // Call the Postgres function to get expiring subscriptions
    const { data: expiringData, error: fetchError } = await supabase
      .rpc('process_subscription_renewals');

    if (fetchError) {
      throw fetchError;
    }

    if (!expiringData || expiringData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expiring subscriptions found',
        processed: 0
      });
    }

    const results = {
      total: expiringData.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each expiring subscription
    for (const sub of expiringData) {
      try {
        const { warehouse_id, plan_tier, days_until_expiry } = sub as any;

        // Create renewal payment link
        const linkResult = await createSubscriptionPaymentLink(
          warehouse_id,
          plan_tier,
          true // isRenewal = true
        );

        if (linkResult.success) {
          results.sent++;
          Logger.info('Renewal link sent', { warehouseId: warehouse_id, daysUntilExpiry: days_until_expiry });
        } else {
          results.failed++;
          results.errors.push(`Warehouse ${warehouse_id}: ${linkResult.error}`);
          logError(new Error(linkResult.error || 'Failed to create renewal link'), {
            operation: 'subscription-renewal-cron',
            metadata: { warehouse_id, plan_tier }
          });
        }

      } catch (error: any) {
        results.failed++;
        results.errors.push(`Subscription ${sub.warehouse_id}: ${error.message}`);
        logError(error, {
          operation: 'subscription-renewal-cron',
          metadata: { subscription: sub }
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.total} expiring subscriptions`,
      results
    });

  } catch (error: any) {
    logError(error, { operation: 'subscription-renewal-cron' });
    return NextResponse.json({
      success: false,
      error: error.message || 'Cron job failed'
    }, { status: 500 });
  }
}
