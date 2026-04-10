import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function CtaSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto rounded-[3rem] bg-primary p-12 lg:p-20 text-center text-primary-foreground relative overflow-hidden shadow-2xl shadow-primary/40">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-80 w-80 rounded-full bg-black/10 blur-3xl" />
        
        <div className="relative space-y-10 z-10">
          <h2 className="text-4xl lg:text-6xl font-bold tracking-tight">
            Ready to revolutionize <br className="hidden md:block" />
            your warehouse?
          </h2>
          
          <p className="text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Join warehouse owners who have simplified their operations and reduced manual work with GrainFlow.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Button size="xl" variant="secondary" className="h-16 px-10 text-xl font-bold rounded-full group bg-background text-primary hover:bg-accent shadow-xl" asChild>
              <Link href="/login" className="flex items-center gap-2">
                Start Free Trial
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </Button>
            <Button size="xl" variant="outline" className="h-16 px-10 text-xl font-bold border-primary-foreground/20 hover:bg-primary-foreground/10 text-primary-foreground hover:text-primary-foreground rounded-full bg-transparent" asChild>
              <Link href="/pricing">View Plans</Link>
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-10 border-t border-primary-foreground/10">
             <div>
                <p className="text-3xl font-bold">100%</p>
                <p className="text-sm text-primary-foreground/70">Data Transparency</p>
             </div>
             <div>
                <p className="text-3xl font-bold">2.5k+</p>
                <p className="text-sm text-primary-foreground/70">Records Managed</p>
             </div>
             <div>
                <p className="text-3xl font-bold">Near-Zero</p>
                <p className="text-sm text-primary-foreground/70">Calculation Errors</p>
             </div>
          </div>
        </div>
      </div>
    </section>
  )
}
