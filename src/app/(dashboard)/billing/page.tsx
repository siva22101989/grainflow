import { PageHeader } from '@/components/shared/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Zap } from 'lucide-react';
import Link from 'next/link';

import { getSubscriptionAction, getAllPlans } from '@/lib/subscription-actions';
import { getUserWarehouse } from '@/lib/queries';
import { PlanTier } from '@/lib/feature-flags';
import { createClient } from '@/utils/supabase/server';
import { UpgradePlanButton } from '@/components/billing/upgrade-plan-button';
import { PaymentHistory } from '@/components/billing/payment-history';
import { formatDate } from '@/lib/utils';


export const revalidate = 60; // Revalidate every 60 seconds

export const metadata = {
  title: 'Billing',
  description: 'Manage subscription and view invoices.',
};

export default async function BillingPage() {
  const currentWarehouseId = await getUserWarehouse() || '';
  
  // Parallel fetching - subscription, record count, and available plans
  const supabase = await createClient();
  const [subscriptionData, { count: recordCount }, availablePlans] = await Promise.all([
    getSubscriptionAction(currentWarehouseId),
    supabase
      .from('storage_records')
      .select('*', { count: 'exact', head: true })
      .eq('warehouse_id', currentWarehouseId)
      .is('deleted_at', null),
    getAllPlans()
  ]);

  const currentPlan = {
    name: subscriptionData?.plans?.name || 'Free Tier',
    tier: (subscriptionData?.plans?.tier as PlanTier) || 'free',
    display_name: subscriptionData?.plans?.display_name || 'Free',
    status: subscriptionData?.status || 'active',
    renewalDate: subscriptionData?.current_period_end 
        ? formatDate(subscriptionData.current_period_end) 
        : 'N/A',
    usage: {
      records: recordCount || 0,
      limit: subscriptionData?.plans?.features?.max_records || 50
    }
  };

  const usagePercent = (currentPlan.usage.records / currentPlan.usage.limit) * 100;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader 
        title="Billing & Subscription" 
        description="Manage your subscription, view usage, and access invoices."
        breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Billing' }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Plan Card */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Current Plan</CardTitle>
            <Badge variant="outline" className="capitalize">{currentPlan.status}</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-primary/10 rounded-full">
                    <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h3 className="text-2xl font-bold">{currentPlan.name}</h3>
                    <p className="text-sm text-muted-foreground">Next renewal: {currentPlan.renewalDate}</p>
                </div>
            </div>

            <div className="space-y-2 mt-6">
                <div className="flex justify-between text-sm">
                    <span>Usage (Records)</span>
                    <span>{currentPlan.usage.records} / {currentPlan.usage.limit}</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${usagePercent}%` }}
                    />
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                    You have used {Math.round(usagePercent)}% of your free tier limit.
                </p>
            </div>
          </CardContent>
          <CardContent className="border-t pt-4">
            <div className="flex justify-end gap-3">
                <Button variant="outline" size="sm" asChild>
                    <Link href="/billing/invoices">View Invoices</Link>
                </Button>
                <UpgradePlanButton 
                  currentTier={currentPlan.tier}
                  warehouseId={currentWarehouseId}
                  availablePlans={availablePlans || []}
                />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm border p-3 rounded-lg opacity-50 italic">
                  <CreditCard className="h-4 w-4" />
                  <span>Payment via Razorpay</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Secure payments powered by Razorpay. Supports UPI, Cards, Net Banking, and more.
              </p>
            </CardContent>
          </Card>

          <PaymentHistory warehouseId={currentWarehouseId} />
        </div>
      </div>
    </div>
  );
}
