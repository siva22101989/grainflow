'use client'

import { GrainFlowLogo } from '@/components/layout/grain-flow-logo'

export function About() {
  return (
    <section id="about" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-full -z-10" />
            <div className="aspect-square rounded-3xl overflow-hidden border bg-card shadow-2xl p-12 flex items-center justify-center relative group">
               <GrainFlowLogo className="w-[120%] h-[120%] text-primary opacity-[0.07] absolute -right-10 -bottom-10 rotate-12 transition-transform group-hover:rotate-6 duration-700" />
               <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                  <h3 className="text-3xl font-bold text-primary mb-4">Our Mission</h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    To digitize the agricultural supply chain, starting with the warehouses that form its backbone.
                  </p>
               </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Built for Resilience</h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                GrainFlow was born out of the need for better transparency in agricultural storage. We understand that in the warehouse business, trust is your most valuable asset.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-8">
              <div className="space-y-2">
                <h4 className="font-bold text-primary italic">Precision Tracking</h4>
                <p className="text-sm text-muted-foreground">Every bag, every lot, and every transaction is recorded with mathematical certainty.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-primary italic">Deep Integration</h4>
                <p className="text-sm text-muted-foreground">From hamali charges to insurance headers, we handle the complex math so you don't have to.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-primary italic">Data Sovereignty</h4>
                <p className="text-sm text-muted-foreground">Your data belongs to you. Export your entire history at anytime in standardized formats.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-primary italic">Future Ready</h4>
                <p className="text-sm text-muted-foreground">Scale from 1,000 bags to 1M+ without breaking a sweat or needing more paperwork.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
