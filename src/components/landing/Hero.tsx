import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { Zap } from 'lucide-react'

export function Hero() {
  return (
    <section className="pt-32 pb-20 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Warehouse Management Built for Agriculture
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
            Smart Inventory for <br />
            <span className="text-primary italic">Modern Agriculture.</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
            GrainFlow replaces manual ledgers with real-time digital tracking, automated billing, and customer portals for agricultural warehouses.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <div className="flex flex-col items-center sm:items-start">
              <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-lg shadow-primary/20" asChild>
                <Link href="/signup">
                  <Zap className="mr-2 h-5 w-5" />
                  Start 14-Day Free Trial
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                No credit card required • Setup in 5 minutes
              </p>
            </div>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full" asChild>
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>

          <div className="flex items-center justify-center lg:justify-start gap-6 text-sm text-muted-foreground">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 w-10 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden relative">
                   <Image 
                      src={`https://i.pravatar.cc/100?img=${i + 10}`} 
                      alt="User" 
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                </div>
              ))}
            </div>
            <p>Trusted by <span className="font-bold text-foreground">warehouse owners across India</span></p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 to-primary/5 blur-3xl rounded-[3rem] -z-10" />
          <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden transform lg:rotate-2 hover:rotate-0 transition-transform duration-500">
             <Image 
                src="/screenshots/dashboard.png" 
                alt="GrainFlow Dashboard" 
                width={1200}
                height={800}
                className="w-full h-auto"
                priority
             />
          </div>
          {/* Floating Card */}
          <div className="absolute -bottom-6 -left-6 bg-background p-4 rounded-xl border shadow-xl hidden sm:flex items-center gap-4 animate-bounce-slow">
             <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
             </div>
             <div>
                <p className="text-xs text-muted-foreground font-medium">Auto-Billing Success</p>
                <p className="font-bold">₹42,500 Collected This Month</p>
             </div>
          </div>
        </div>
      </div>
    </section>
  )
}
