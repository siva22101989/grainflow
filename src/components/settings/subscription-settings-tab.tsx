'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Zap } from 'lucide-react';
import { useSubscription } from '@/components/providers/subscription-context';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { RedeemCodeDialog } from '@/components/subscription/redeem-code-dialog';

export function SubscriptionSettingsTab() {
    const { subscription, loading } = useSubscription();
    const router = useRouter();

    if (loading) {
        return <div className="p-4 text-center text-muted-foreground">Loading subscription details...</div>;
    }

    if (!subscription) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>No Active Subscription</CardTitle>
                    <CardDescription>Get started with a premium plan to unlock more features.</CardDescription>
                </CardHeader>
                <CardFooter className="flex gap-2">
                    <Button onClick={() => router.push('/upgrade')} variant="outline">View Plans</Button>
                    {/* Note: Warehouse ID should be passed in safely */}
                     <Button onClick={() => router.push('/upgrade')}>Contact for Code</Button>
                </CardFooter>
            </Card>
        );
    }

    const { plan, status } = subscription;
    const isTrial = status === 'trailing_trial';
    const isActive = status === 'active';
    const isPastDue = status === 'past_due';

    return (
        <div className="grid gap-6">
            <Card className={isPastDue ? "border-destructive" : ""}>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl flex items-center gap-2">
                                {plan.tier === 'enterprise' && <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
                                {plan.tier === 'professional' && <CheckCircle2 className="w-5 h-5 text-primary" />}
                                {plan.name} Plan
                            </CardTitle>
                            <CardDescription className="mt-1">
                                {isTrial ? 'Trial Period' : `${isActive ? 'Active' : 'Inactive'} Subscription`}
                            </CardDescription>
                        </div>
                        <Badge variant={isActive ? "default" : "destructive"} className="uppercase">
                            {status.replace('_', ' ')}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-6">
                    {/* Usage Stats - Only show for non-enterprise or when wired up */}
                    {plan.tier !== 'enterprise' ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Warehouse Storage</span>
                                    {/* Using 1000 as default fallback limit if undefined, just for visualization */}
                                    <span className="font-medium">
                                        {Math.round((subscription.usage.total_records / (plan.features?.max_storage_records || 1000)) * 100)}% Used
                                    </span>
                                </div>
                                <Progress 
                                    value={(subscription.usage.total_records / (plan.features?.max_storage_records || 1000)) * 100} 
                                    className="h-2" 
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    {subscription.usage.total_records} / {plan.features?.max_storage_records || 'Unlimited'} Records
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Monthly Inflows</span>
                                    <span className="font-medium">
                                        {subscription.usage.monthly_records} Records
                                    </span>
                                </div>
                                {/* Inflow limit usually not strict, but visualizing relative activity */}
                                <Progress value={(subscription.usage.monthly_records / 100) * 100} className="h-2" />
                            </div>
                        </div>
                    ) : (
                         <div className="space-y-4">
                            <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
                                <span className="text-sm font-medium">Usage Limits</span>
                                <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                    Unlimited Access
                                </Badge>
                            </div>
                        </div>
                    )}

                    <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Next Billing Date</span>
                            <span className="font-medium">
                                {subscription.current_period_end 
                                    ? format(new Date(subscription.current_period_end), 'MMMM d, yyyy')
                                    : 'Lifetime / Manual'}
                            </span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t px-6 py-4 bg-muted/20">
                    <Button variant="outline" onClick={() => router.push('/upgrade')}>
                        View All Plans
                    </Button>
                    <RedeemCodeDialog warehouseId={subscription.warehouse_id} />
                </CardFooter>
            </Card>

            {/* Payment History Placeholder */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Payments</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-center py-6 text-muted-foreground">
                        No recent payment history available.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
