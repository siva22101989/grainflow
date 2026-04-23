import { LandingHeader } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';

export const metadata = {
  title: 'Terms of Service | GrainFlow',
  description: 'GrainFlow terms of service.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-headline font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">Last updated: 23 April 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">1. Acceptance of terms</h2>
            <p className="text-muted-foreground">
              By creating an account or using GrainFlow, you agree to these terms. If you don&apos;t
              agree, don&apos;t use the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">2. What GrainFlow provides</h2>
            <p className="text-muted-foreground">
              GrainFlow is a software-as-a-service (SaaS) warehouse management platform. We
              provide the tools; you provide and own the data you enter.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">3. Your account</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>You are responsible for keeping your login credentials secure.</li>
              <li>You are responsible for all activity under your account.</li>
              <li>You must provide accurate information when registering.</li>
              <li>Don&apos;t share your account with people outside your warehouse team.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">4. Subscriptions and billing</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Paid plans are billed monthly or yearly as selected at checkout.</li>
              <li>Payments are processed by Razorpay; we don&apos;t store card details.</li>
              <li>Subscriptions auto-renew unless cancelled before the renewal date.</li>
              <li>
                Refunds: full refund within 7 days of first paid subscription if unused. After
                that, refunds are evaluated case by case.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">5. Your data</h2>
            <p className="text-muted-foreground">
              You own everything you enter into GrainFlow. We store and process it on your behalf
              to provide the service. You can export your data any time. If you cancel, you have
              30 days to export before we permanently delete operational data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">6. Acceptable use</h2>
            <p className="text-muted-foreground mb-2">Don&apos;t use GrainFlow to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Send spam or unsolicited SMS.</li>
              <li>Violate any law or regulation.</li>
              <li>Attack, hack, or reverse-engineer the service.</li>
              <li>Resell access or white-label without a written agreement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">7. SMS delivery</h2>
            <p className="text-muted-foreground">
              SMS is delivered via third-party gateways. We don&apos;t guarantee delivery time or
              success for every message. Carrier throttling, DLT compliance issues, or gateway
              downtime are outside our control.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">8. Uptime and support</h2>
            <p className="text-muted-foreground">
              We aim for high availability but don&apos;t guarantee uninterrupted service. Support
              is available via email and WhatsApp during business hours (IST).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">9. Limitation of liability</h2>
            <p className="text-muted-foreground">
              GrainFlow is provided &quot;as is&quot;. To the maximum extent permitted by law, our
              total liability for any claim is limited to the fees you paid in the 3 months
              preceding the claim. We are not liable for indirect, incidental, or consequential
              damages.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">10. Changes to the service</h2>
            <p className="text-muted-foreground">
              We may update, add, or remove features over time. Major changes will be communicated
              via email or in-app notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">11. Termination</h2>
            <p className="text-muted-foreground">
              You can cancel any time. We may suspend or terminate accounts that violate these
              terms, or that remain inactive for 12+ months.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">12. Governing law</h2>
            <p className="text-muted-foreground">
              These terms are governed by the laws of India. Disputes are subject to the
              exclusive jurisdiction of courts in Andhra Pradesh.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">13. Contact</h2>
            <p className="text-muted-foreground">
              Questions? Email{' '}
              <a href="mailto:nikhilpnkr@gmail.com" className="text-primary hover:underline">
                nikhilpnkr@gmail.com
              </a>{' '}
              or call{' '}
              <a href="tel:+919573299175" className="text-primary hover:underline">
                +91 95732 99175
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
