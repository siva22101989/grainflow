import { LandingHeader } from '@/components/landing/Header'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { Testimonials } from '@/components/landing/Testimonials'
import { About } from '@/components/landing/About'
import { CtaSection } from '@/components/landing/CtaSection'
import { Footer } from '@/components/landing/Footer'
import { WhatsAppChatButton } from '@/components/landing/whatsapp-chat-button'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background selection:bg-primary/10 selection:text-primary">
      <LandingHeader />
      
      <main>
        {/* Glow Effects */}
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
        
        <Hero />
        <Features />
        <Testimonials />
        <About />
        <CtaSection />
      </main>

      <Footer />
      <WhatsAppChatButton />
    </div>
  )
}
