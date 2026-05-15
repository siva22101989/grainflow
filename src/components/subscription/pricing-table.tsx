'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { PlanTier } from '@/lib/feature-flags';

interface PricingPlan {
  tier: PlanTier;
  name: string;
  price: string;
  description: string;
  features: string[];
  buttonText: string;
  highlighted?: boolean;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    tier: 'free',
    name: 'Free',
    price: '₹0',
    description: 'Perfect for getting started.',
    features: ['Up to 100 records', '1 Warehouse', 'Basic Reports', 'Community Support'],
    buttonText: 'Current Plan',
  },
  {
    // Tier MUST match `plans.tier` in the DB so createSubscriptionPaymentLink
    // can look it up. DB has '_monthly' / '_yearly' suffixed tiers.
    tier: 'starter_monthly',
    name: 'Starter',
    price: '₹499',
    description: 'Better tools for small warehouses.',
    features: ['10,000 records', '1 Warehouse', 'Export Reports', 'SMS Notifications', 'Priority Support'],
    buttonText: 'Upgrade to Starter',
    highlighted: true,
  },
  {
    tier: 'professional_monthly',
    name: 'Professional',
    price: '₹1,499',
    description: 'Advanced features for growing businesses.',
    features: ['100,000 records', 'Multiple Warehouses', 'Analytics Dashboard', 'WhatsApp Integration', 'Dedicated Manager'],
    buttonText: 'Upgrade to Pro',
  },
];

// Hidden smoke-test plan. Only shown when ?test=1 is in the URL — used to
// verify the live Razorpay flow end-to-end with ₹1 of real money before
// pointing real customers at the upgrade page.
const TEST_PLAN: PricingPlan = {
  tier: 'test_1rupee',
  name: 'TEST ₹1 (do not use)',
  price: '₹1',
  description: 'Smoke test for Razorpay live keys. Refund yourself after.',
  features: ['Verifies payment link creation', 'Verifies webhook fires', 'Verifies subscription activation', '7 day duration'],
  buttonText: 'Pay ₹1 (Test)',
};

export function PricingTable({
    currentTier,
    onSelect,
    showTestPlan = false,
}: {
    currentTier?: PlanTier,
    onSelect: (tier: PlanTier) => void,
    showTestPlan?: boolean,
}) {
  const plans = showTestPlan ? [...PRICING_PLANS, TEST_PLAN] : PRICING_PLANS;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto py-8">
      {plans.map((plan) => (
        <Card key={plan.tier} className={`flex flex-col ${plan.highlighted ? 'border-primary shadow-md relative' : ''}`}>
          {plan.highlighted && (
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
              POPULAR
            </div>
          )}
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>{plan.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="mb-4">
              <span className="text-3xl font-bold">{plan.price}</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
            <ul className="space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
                variant={plan.highlighted ? 'default' : 'outline'} 
                className="w-full"
                disabled={currentTier === plan.tier}
                onClick={() => onSelect(plan.tier)}
            >
              {currentTier === plan.tier ? 'Current Plan' : plan.buttonText}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
