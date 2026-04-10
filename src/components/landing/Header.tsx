'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { GrainFlowLogo } from '@/components/layout/grain-flow-logo'
import { ModeToggle } from '@/components/mode-toggle'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className={cn(
      "fixed top-0 w-full z-50 transition-all duration-300 px-6 h-20 flex items-center justify-between",
      scrolled ? "bg-background/80 backdrop-blur-md border-b" : "bg-transparent"
    )}>
      <Link href="/" className="flex items-center gap-3">
        <div className="relative h-10 w-10">
          <GrainFlowLogo className="h-full w-full" />
        </div>
        <span className="font-headline font-bold text-xl text-primary tracking-tight">GrainFlow</span>
      </Link>

      <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
        <Link href="/#features" className="hover:text-primary transition-colors">Features</Link>
        <Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link>
        <Link href="/#about" className="hover:text-primary transition-colors">About</Link>
      </nav>

      <div className="flex items-center gap-4">
        <ModeToggle />
        <Button variant="ghost" asChild className="hidden sm:inline-flex">
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild>
          <Link href="/login">Get Started</Link>
        </Button>
      </div>
    </header>
  )
}
