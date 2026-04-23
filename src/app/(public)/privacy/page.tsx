import { LandingHeader } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';

export const metadata = {
  title: 'Privacy Policy | GrainFlow',
  description: 'GrainFlow privacy policy — how we collect, use, and protect your data.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-headline font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: 23 April 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">1. Who we are</h2>
            <p className="text-muted-foreground">
              GrainFlow is a warehouse management platform operated from India. This policy
              explains how we collect, use, and protect your data when you use our app.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">2. Data we collect</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>Account data:</strong> Name, email, phone number, warehouse details, role.
              </li>
              <li>
                <strong>Operational data:</strong> Customer records, inflow/outflow records,
                payments, expenses, crops and pricing configured by you.
              </li>
              <li>
                <strong>Usage data:</strong> Pages visited, actions performed, error logs (via
                Sentry), for improving the product and debugging issues.
              </li>
              <li>
                <strong>SMS logs:</strong> When your warehouse sends SMS via GrainFlow, we store
                the recipient phone, message type, and timestamp for audit.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">3. How we use your data</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>To provide warehouse management functionality for you and your team.</li>
              <li>To send SMS notifications to your customers (when you configure these).</li>
              <li>To process subscription payments via Razorpay.</li>
              <li>To troubleshoot issues and improve the product.</li>
              <li>To comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">4. Data sharing</h2>
            <p className="text-muted-foreground">
              We do not sell your data. We share data only with the service providers needed to
              run GrainFlow:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
              <li>
                <strong>Supabase</strong> — database, authentication, storage.
              </li>
              <li>
                <strong>Vercel</strong> — application hosting.
              </li>
              <li>
                <strong>Razorpay</strong> — subscription payment processing.
              </li>
              <li>
                <strong>TextBee</strong> — SMS delivery gateway.
              </li>
              <li>
                <strong>Sentry</strong> — error monitoring.
              </li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Each of these providers has their own privacy practices. We restrict what we share
              to the minimum needed for the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">5. Data isolation</h2>
            <p className="text-muted-foreground">
              Your warehouse&apos;s data is strictly isolated from other warehouses via row-level
              security. Only users you invite to your warehouse can see your records.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">6. Your rights</h2>
            <p className="text-muted-foreground">
              You can export your data at any time via the Settings &rarr; Data page. You can
              request deletion of your account and all associated data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">7. Data retention</h2>
            <p className="text-muted-foreground">
              We retain your operational data for as long as your account is active. If you
              delete your account, we retain anonymized transaction records for audit and tax
              compliance where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">8. Security</h2>
            <p className="text-muted-foreground">
              All data in transit is encrypted (HTTPS). Passwords are hashed. Row-level security
              prevents cross-tenant access. We never ask for your password outside the login
              page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-headline font-bold mb-3">9. Contact</h2>
            <p className="text-muted-foreground">
              Questions about this policy? Email us at{' '}
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
