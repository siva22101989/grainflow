'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';

interface SubscriptionAlertProps {
  subscription: {
    status: string;
    current_period_end?: string;
    grace_period_end?: string;
    plan?: {
      name: string;
      tier: string;
    };
  } | null;
}

export function SubscriptionAlert({ subscription }: SubscriptionAlertProps) {
  const router = useRouter();

  if (!subscription) return null;

  const { status, current_period_end, grace_period_end, plan } = subscription;

  // Grace Period Warning
  if (status === 'grace_period' && grace_period_end) {
    const daysLeft = Math.ceil(
      (new Date(grace_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return (
      <Alert variant="destructive" className="mb-6 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <AlertTitle className="text-orange-900 dark:text-orange-100">
          Subscription in Grace Period
        </AlertTitle>
        <AlertDescription className="text-orange-800 dark:text-orange-200">
          Your subscription expired on {formatDate(current_period_end!)}.
          You have <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong> remaining to renew before your account is downgraded to the Free plan.
          <div className="mt-3">
            <Button 
              variant="default" 
              size="sm"
              onClick={() => router.push('/upgrade')}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Renew Now
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Expiring Soon (7 days or less)
  if (status === 'active' && current_period_end) {
    const daysUntilExpiry = Math.ceil(
      (new Date(current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
      return (
        <Alert variant="default" className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <Clock className="h-5 w-5 text-yellow-600" />
          <AlertTitle className="text-yellow-900 dark:text-yellow-100">
            Subscription Expiring Soon
          </AlertTitle>
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            Your {plan?.name || 'subscription'} will expire in <strong>{daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}</strong> on {formatDate(current_period_end)}.
            <div className="mt-3">
              <Button 
                variant="default" 
                size="sm"
                onClick={() => router.push('/upgrade')}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                Renew Subscription
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }
  }

  // Recently Downgraded to Free
  if (status === 'active' && plan?.tier === 'free') {
    // Check if recently updated (within last 24 hours)
    // This would require updated_at field, for now just show if on Free plan
    return (
      <Alert variant="default" className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
        <XCircle className="h-5 w-5 text-blue-600" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">
          You're on the Free Plan
        </AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          Upgrade to unlock premium features like unlimited storage records, advanced analytics, and priority support.
          <div className="mt-3">
            <Button 
              variant="default" 
              size="sm"
              onClick={() => router.push('/upgrade')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              View Plans
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
