import { NextRequest, NextResponse } from 'next/server';
import { processExpiredSubscriptions, sendExpiryWarnings } from '@/lib/subscription-actions';
import { logError } from '@/lib/error-logger';

/**
 * API Route for subscription expiry cron job
 * Can be called by:
 * 1. Vercel Cron (vercel.json)
 * 2. GitHub Actions
 * 3. Manual trigger by super admin
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Process expired subscriptions
    const expiryResult = await processExpiredSubscriptions();
    
    // Send proactive warnings
    const warningsResult = await sendExpiryWarnings();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      expiry: {
        processed: expiryResult.processed,
        gracePeriod: expiryResult.gracePeriod,
        expired: expiryResult.expired,
        downgraded: expiryResult.downgraded,
        errors: expiryResult.errors
      },
      warnings: {
        sent: warningsResult.warningsSent,
        errors: warningsResult.errors
      }
    });
  } catch (error: any) {
    logError(error, { operation: 'cron.subscriptionExpiry' });
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Allow POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
