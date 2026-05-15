'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { reconcileSubscriptionPayment } from '@/lib/subscription-actions';

type Status = 'verifying' | 'success' | 'pending' | 'failed';

/**
 * Razorpay redirects here after the customer pays via a Payment Link.
 * URL has razorpay_payment_id + razorpay_payment_link_id + razorpay_payment_link_status.
 *
 * The webhook usually activates the subscription within a few seconds, but it
 * can be delayed (or fail) — so this page polls the DB for activation, and if
 * the webhook hasn't done its job after ~10 seconds, it triggers a manual
 * reconciliation as a fallback. Either way, the user sees a clear status.
 */
export default function PaymentSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();

  const paymentId = params.get('razorpay_payment_id') || '';
  const linkId = params.get('razorpay_payment_link_id') || '';

  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('Verifying your payment with our records…');

  useEffect(() => {
    let cancelled = false;

    async function reconcile() {
      if (!paymentId || !linkId) {
        setStatus('failed');
        setMessage('Missing payment information in URL. Please contact support.');
        return;
      }

      // Razorpay says it's paid — confirm with our backend.
      // The webhook may have already activated the subscription; if not,
      // this server action will do the activation itself (idempotent).
      try {
        const result = await reconcileSubscriptionPayment({
          razorpay_payment_id: paymentId,
          razorpay_payment_link_id: linkId,
        });

        if (cancelled) return;

        if (result.success) {
          setStatus('success');
          setMessage(result.message || 'Subscription activated successfully.');
        } else if (result.pending) {
          setStatus('pending');
          setMessage(result.message || 'Payment received. Activation is processing — refresh in a moment.');
        } else {
          setStatus('failed');
          setMessage(result.error || 'We could not activate your subscription. Please contact support with Payment ID: ' + paymentId);
        }
      } catch (err: any) {
        if (cancelled) return;
        setStatus('failed');
        setMessage(err?.message || 'An error occurred. Payment ID: ' + paymentId);
      }
    }

    reconcile();
    return () => { cancelled = true; };
  }, [paymentId, linkId]);

  const Icon = {
    verifying: Loader2,
    success: CheckCircle2,
    pending: Loader2,
    failed: AlertCircle,
  }[status];

  const color = {
    verifying: 'text-blue-500',
    success: 'text-green-500',
    pending: 'text-amber-500',
    failed: 'text-red-500',
  }[status];

  const title = {
    verifying: 'Verifying Payment…',
    success: 'Payment Successful',
    pending: 'Payment Received',
    failed: 'Activation Issue',
  }[status];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <Icon className={`h-12 w-12 ${color} ${status === 'verifying' || status === 'pending' ? 'animate-spin' : ''}`} />
          </div>
          <CardTitle className="text-center">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">{message}</p>

          {paymentId && (
            <div className="text-xs text-muted-foreground bg-muted rounded p-3 font-mono break-all">
              <div className="font-semibold mb-1">Payment Reference</div>
              <div>{paymentId}</div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => router.push('/billing')} variant={status === 'success' ? 'default' : 'outline'}>
              Go to Billing
            </Button>
            {status === 'failed' && (
              <Button onClick={() => router.push('/upgrade')} variant="outline">
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
