'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { PricingTable } from '@/components/subscription/pricing-table';
import { useUnifiedToast } from '@/components/shared/toast-provider';
import { createSubscriptionPaymentLink } from '@/lib/subscription-actions';
import { PlanTier } from '@/lib/feature-flags';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWarehouses } from '@/contexts/warehouse-context';

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);
  const { success: toastSuccess, error: toastError } = useUnifiedToast();
  const router = useRouter();

  const { currentWarehouse } = useWarehouses();
  const warehouseId = currentWarehouse?.id;
  const searchParams = useSearchParams();
  const showTestPlan = searchParams.get('test') === '1';

  const handleUpgrade = async (tier: PlanTier) => {
    if (tier === 'free') return;

    setLoading(true);
    try {
      // Pass whatever the client context has; the server action falls back to
      // getActiveWarehouseId() if it's empty. Avoids a race where the warehouse
      // provider hasn't hydrated yet when the user clicks.
      const result = await createSubscriptionPaymentLink(warehouseId || '', tier, false);

      if (result.success && result.linkUrl) {
          toastSuccess('Redirecting to payment…', 'Opening Razorpay checkout. SMS link also sent as backup.');
          // Open Razorpay-hosted payment page in a new tab so the dashboard
          // stays open. Customer pays, webhook activates, billing page reflects it.
          window.open(result.linkUrl, '_blank', 'noopener,noreferrer');
          // Send the user to /billing so they can see the pending payment + retry if needed
          router.push('/billing');
      } else {
          toastError('Error', result.error || 'Failed to start checkout');
      }
    } catch (err) {
      toastError('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader 
        title="Upgrade Your Plan" 
        description="Choose a plan that fits your warehouse operations and unlock advanced features."
        breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Billing', href: '/billing' },
            { label: 'Upgrade' }
        ]}
      />

      <div className={loading ? 'opacity-50 pointer-events-none transition-opacity' : ''}>
        <PricingTable onSelect={handleUpgrade} showTestPlan={showTestPlan} />
      </div>

      <div className="text-center mt-8 text-sm text-muted-foreground">
        <p>Current plan: Free Tier</p>
        <p className="mt-2 italic">Note: In local development, some payment features might be simulated.</p>
      </div>
    </div>
  );
}
