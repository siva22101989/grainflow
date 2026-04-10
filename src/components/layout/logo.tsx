'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { GrainFlowLogo } from '@/components/layout/grain-flow-logo'

interface LogoProps {
  href?: string;
}

export function Logo({ href = '/' }: LogoProps) {
  const pathname = usePathname()
  const router = useRouter()
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    
    // If already on the target path, scroll to top smoothly
    if (pathname === href) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    
    // Replace history (don't add to stack) - prevents back button navigation
    router.replace(href)
  }
  
  return (
    <Link 
      href={href} 
      onClick={handleClick}
      className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer" 
      aria-label="GrainFlow"
    >
      <div className="bg-white p-1 rounded-full border border-border shadow-sm">
        <GrainFlowLogo className="h-8 w-8" />
      </div>
      <span className="font-headline font-bold text-xl text-primary hidden sm:inline tracking-tight">GrainFlow</span>
    </Link>
  )
}
