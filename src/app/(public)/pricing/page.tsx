'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Phone } from 'lucide-react';
import Link from 'next/link';
import { Footer } from '@/components/landing/Footer';
import { LandingHeader } from '@/components/landing/Header';
import { ContactSalesDialog } from '@/components/contact-sales-dialog';

export default function PricingPage() {
    const [billingPeriod, setBillingPeriod] = React.useState<'monthly' | 'yearly'>('monthly');
    
    const plans = [
        {
            name: 'Free',
            monthlyPrice: 0,
            yearlyPrice: 0,
            description: 'Perfect for testing and small operations.',
            features: [
                'Basic Inventory (Inflow/Outflow)',
                'Customer Management',
                'Basic Reports & Export',
                '2 Users Maximum',
                '250 Active Storage Records'
            ],
            tier: 'free',
            cta: 'Start Free Trial',
            popular: false,
            link: '/signup'
        },
        {
            name: 'Starter',
            monthlyPrice: 499,
            yearlyPrice: 4790, // ~20% discount (2 months free)
            description: 'For growing warehouses managing regular operations.',
            features: [
                'Everything in Free',
                'Advanced Reports (PDF/Excel)',
                'SMS Notifications',
                '5 Users Maximum',
                '10,000 Active Storage Records'
            ],
            tier: 'starter',
            cta: 'Start Free Trial',
            popular: true,
            link: '/signup?plan=starter'
        },
        {
            name: 'Professional',
            monthlyPrice: 1499,
            yearlyPrice: 14390, // ~20% discount
            description: 'Power features for established businesses.',
            features: [
                'Everything in Starter',
                'Analytics Dashboard with AI Insights',
                'Multiple Warehouses',
                '15 Users Maximum',
                'Unlimited Storage Records'
            ],
            tier: 'professional',
            cta: 'Start Free Trial',
            popular: false,
            link: '/signup?plan=professional'
        },
        {
            name: 'Enterprise',
            monthlyPrice: null,
            yearlyPrice: null,
            description: 'Tailored solutions for large-scale operations.',
            features: [
                'Everything in Professional',
                'API Access & Custom Integrations',
                'Dedicated Account Manager',
                'Unlimited Users',
                'Priority Support (24/7)'
            ],
            tier: 'enterprise',
            cta: 'Contact Sales',
            popular: false,
            link: null
        }
    ];

    const getPriceDisplay = (plan: typeof plans[0]) => {
        if (plan.tier === 'enterprise') return 'Custom';
        if (plan.monthlyPrice === 0) return 'Free';

        const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
        const period = billingPeriod === 'monthly' ? '/month' : '/year';

        return `₹${price?.toLocaleString()}${period}`;
    };

    return (
        <div className="min-h-screen bg-background selection:bg-primary/10 selection:text-primary">
            <LandingHeader />

            <main className="pt-32 pb-20 px-6">
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
                        Simple, transparent pricing
                    </h1>
                    <p className="text-xl text-muted-foreground mb-8">
                        Choose the plan that's right for your warehouse. All plans include a 14-day free trial.
                    </p>
                    
                    {/* Billing Period Toggle */}
                    <div className="inline-flex items-center bg-muted p-1 rounded-lg">
                        <Button
                            variant={billingPeriod === 'monthly' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setBillingPeriod('monthly')}
                            className="rounded-md"
                        >
                            Monthly
                        </Button>
                        <Button
                            variant={billingPeriod === 'yearly' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setBillingPeriod('yearly')}
                            className="rounded-md"
                        >
                            Yearly
                            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">Save 20%</Badge>
                        </Button>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                    {plans.map((plan) => (
                        <Card key={plan.name} className={`flex flex-col ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}>
                            <CardHeader>
                                {plan.popular && (
                                    <div className="text-primary text-sm font-semibold tracking-wide uppercase mb-2">
                                        Most Popular
                                    </div>
                                )}
                                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                                <CardDescription>{plan.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <div className="mb-6">
                                    <div className="text-4xl font-bold">
                                        {getPriceDisplay(plan)}
                                    </div>
                                    {billingPeriod === 'yearly' && plan.monthlyPrice && plan.monthlyPrice > 0 && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            ₹{Math.round(plan.yearlyPrice! / 12)}/month billed annually
                                        </p>
                                    )}
                                </div>
                                <ul className="space-y-3">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-center gap-2">
                                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                            <span className="text-sm">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                            <CardFooter>
                                {plan.cta === 'Contact Sales' ? (
                                    <ContactSalesDialog>
                                        <Button className="w-full" size="lg" variant={plan.popular ? 'default' : 'outline'}>
                                            {plan.cta}
                                        </Button>
                                    </ContactSalesDialog>
                                ) : (
                                    <Button className="w-full" size="lg" variant={plan.popular ? 'default' : 'outline'} asChild>
                                        <Link href={plan.link || '/signup'}>
                                            {plan.cta}
                                            <span className="ml-2 text-xs">→</span>
                                        </Link>
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
                
                {/* FAQ Section */}
                <div className="mt-24 max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="trial">
                            <AccordionTrigger>How does the 14-day free trial work?</AccordionTrigger>
                            <AccordionContent>
                                Sign up for any plan and get full access for 14 days. No credit card required. After the trial, you can choose to continue with a paid plan or stay on the free tier.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="upgrade">
                            <AccordionTrigger>Can I upgrade or downgrade anytime?</AccordionTrigger>
                            <AccordionContent>
                                Yes! You can change your plan at any time. Upgrades take effect immediately, and downgrades apply at the end of your current billing cycle.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="payment">
                            <AccordionTrigger>What payment methods do you accept?</AccordionTrigger>
                            <AccordionContent>
                                We accept UPI, Bank Transfer (NEFT/RTGS/IMPS), and Cash for local customers. For Enterprise customers, we also offer invoice-based billing with NET-30 terms.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="data">
                            <AccordionTrigger>Is my data secure?</AccordionTrigger>
                            <AccordionContent>
                                Absolutely. We use bank-grade encryption (AES-256) for all data. Daily automated backups ensure your data is safe. We're hosted on Supabase with enterprise-level security.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="records">
                            <AccordionTrigger>What counts as a "Storage Record"?</AccordionTrigger>
                            <AccordionContent>
                                A storage record is one active grain deposit from a customer. For example, if you have 100 customers with bags currently stored, that's 100 records. Completed/withdrawn records don't count toward your limit.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="refund">
                            <AccordionTrigger>Do you offer refunds?</AccordionTrigger>
                            <AccordionContent>
                                Yes, we offer a 30-day money-back guarantee on all paid plans. If you're not satisfied, contact us within 30 days for a full refund.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
                
                <div className="mt-16 text-center">
                    <h3 className="text-2xl font-bold mb-4">Still have questions?</h3>
                    <p className="text-muted-foreground mb-6">
                         Our team is here to help you choose the right plan.
                    </p>
                    <ContactSalesDialog>
                        <Button size="lg">
                            <Phone className="mr-2 h-4 w-4" />
                            Contact Sales Team
                        </Button>
                    </ContactSalesDialog>
                </div>
            </main>
            <Footer />
        </div>
    );
}
