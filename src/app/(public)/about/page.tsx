import { LandingHeader } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Wheat, Target, Users, HeartHandshake } from 'lucide-react';

export const metadata = {
  title: 'About Us | GrainFlow',
  description:
    'GrainFlow is an intelligent warehouse management system built for the agricultural supply chain in India.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tight mb-4">
            Built for Indian warehouses
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            GrainFlow is an agricultural warehouse management platform designed for paddy and grain
            storage businesses across India. We help warehouse owners run their operations with
            clarity, accuracy, and zero guesswork.
          </p>
        </div>

        <section className="mb-16">
          <h2 className="text-2xl font-headline font-bold mb-6 flex items-center gap-3">
            <Target className="h-6 w-6 text-primary" />
            Our mission
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Warehouse operations in India still run on ledgers and memory. Hamali rates vary by
            farmer. Rent calculations differ by season and crop. Payments come in part by part.
            Every warehouse owner we talked to kept the same notebook that their father kept —
            and their father&apos;s father before him.
          </p>
          <p className="text-muted-foreground text-lg leading-relaxed mt-4">
            GrainFlow digitizes that notebook. We built the billing, storage, and payment
            tracking that matches how you actually operate — with flexible per-crop pricing,
            drying-loss accounting, and SMS confirmations in plain language.
          </p>
        </section>

        <section className="mb-16 grid md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              <Wheat className="h-8 w-8 text-amber-600 mb-3" />
              <h3 className="font-bold text-lg mb-2">Crop-aware billing</h3>
              <p className="text-muted-foreground">
                Set different rates for Paddy, Wheat, Empty Bags, and more. Per-crop insurance,
                minimum storage periods, and tiered monthly pricing.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Users className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="font-bold text-lg mb-2">Multi-user, multi-warehouse</h3>
              <p className="text-muted-foreground">
                Owners, admins, managers, and staff — each with scoped access. Run multiple
                warehouses from a single account.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <HeartHandshake className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="font-bold text-lg mb-2">Customer-friendly</h3>
              <p className="text-muted-foreground">
                Automatic SMS confirmations for every inflow, outflow, and payment. Customers
                know their stock and dues at a glance.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Target className="h-8 w-8 text-purple-600 mb-3" />
              <h3 className="font-bold text-lg mb-2">Accurate, not approximate</h3>
              <p className="text-muted-foreground">
                Drying loss, gross vs stored bags, hamali splits for unloading + stacking. Every
                rupee accounted for — no warehouse absorbing losses because the software
                oversimplified.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="text-center">
          <h2 className="text-2xl font-headline font-bold mb-4">Get in touch</h2>
          <p className="text-muted-foreground mb-2">
            Questions, feedback, or want to try GrainFlow for your warehouse?
          </p>
          <p className="text-muted-foreground">
            <a href="/contact" className="text-primary font-semibold hover:underline">
              Contact our team →
            </a>
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
