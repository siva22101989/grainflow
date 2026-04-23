import { LandingHeader } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Phone, MessageCircle, MapPin, Clock } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Contact Sales | GrainFlow',
  description:
    'Talk to the GrainFlow team. We help warehouse owners pick the right plan and get set up in under a day.',
};

const WHATSAPP_LINK =
  'https://wa.me/919573299175?text=' +
  encodeURIComponent("Hi! I'm interested in learning more about GrainFlow. Can you help me get started?");

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tight mb-4">
            Let&apos;s talk
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you&apos;re evaluating GrainFlow for your warehouse or need help with an
            existing account, we&apos;re here. Most people get a reply within a few hours.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 flex flex-col h-full">
              <MessageCircle className="h-10 w-10 text-[#25D366] mb-3" />
              <h3 className="font-bold text-xl mb-2">WhatsApp (fastest)</h3>
              <p className="text-muted-foreground mb-4 flex-1">
                Chat with us on WhatsApp for the quickest response. Usually under an hour during
                business hours.
              </p>
              <Button asChild className="bg-[#25D366] hover:bg-[#20BA5A] text-white w-full">
                <Link href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                  Open WhatsApp chat
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 flex flex-col h-full">
              <Phone className="h-10 w-10 text-primary mb-3" />
              <h3 className="font-bold text-xl mb-2">Call us</h3>
              <p className="text-muted-foreground mb-4 flex-1">
                Prefer a call? Ring us on the number below during business hours (9 AM – 7 PM IST).
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="tel:+919573299175">+91 95732 99175</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 flex flex-col h-full">
              <Mail className="h-10 w-10 text-blue-600 mb-3" />
              <h3 className="font-bold text-xl mb-2">Email</h3>
              <p className="text-muted-foreground mb-4 flex-1">
                Send us a detailed question and we&apos;ll get back within 24 hours.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="mailto:nikhilpnkr@gmail.com">nikhilpnkr@gmail.com</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 flex flex-col h-full">
              <Clock className="h-10 w-10 text-amber-600 mb-3" />
              <h3 className="font-bold text-xl mb-2">Business hours</h3>
              <p className="text-muted-foreground mb-2">Monday – Saturday</p>
              <p className="text-muted-foreground">9:00 AM – 7:00 PM IST</p>
              <p className="text-sm text-muted-foreground mt-2">
                Closed Sundays and public holidays.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/30">
          <CardContent className="pt-6 flex flex-col md:flex-row md:items-center gap-4">
            <MapPin className="h-8 w-8 text-primary shrink-0" />
            <div>
              <h3 className="font-bold text-lg">Primary contact</h3>
              <p className="text-muted-foreground">
                <strong>Nikhil</strong> &middot;{' '}
                <a href="mailto:nikhilpnkr@gmail.com" className="text-primary hover:underline">
                  nikhilpnkr@gmail.com
                </a>{' '}
                &middot;{' '}
                <a href="tel:+919573299175" className="text-primary hover:underline">
                  +91 95732 99175
                </a>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Based in Andhra Pradesh, India. Serving warehouses across India.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
