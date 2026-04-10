import Link from 'next/link'
import { GrainFlowLogo } from '@/components/layout/grain-flow-logo'

export function Footer() {
  return (
    <footer className="bg-card text-muted-foreground py-20 px-6 mt-20 border-t border-border">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 border-b border-border pb-16">
        <div className="col-span-1 md:col-span-2 space-y-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-primary/10 p-1 rounded-full text-primary">
              <GrainFlowLogo className="h-8 w-8" />
            </div>
            <span className="font-headline font-bold text-2xl text-foreground tracking-tight">GrainFlow</span>
          </Link>
          <p className="max-w-sm text-muted-foreground text-lg leading-relaxed">
            The intelligent warehouse management system designed for the agricultural supply chain in India.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-foreground mb-6 uppercase text-sm tracking-widest font-headline">Product</h4>
          <ul className="space-y-4">
            <li><Link href="#features" className="hover:text-primary transition-colors">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
            <li><Link href="/guide" className="hover:text-primary transition-colors">Help Center</Link></li>
            <li><Link href="/portal" className="hover:text-primary transition-colors">Customer Portal</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-foreground mb-6 uppercase text-sm tracking-widest font-headline">Company</h4>
          <ul className="space-y-4">
            <li><Link href="#about" className="hover:text-primary transition-colors">About Us</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link></li>
            <li><Link href="#" className="hover:text-primary transition-colors">Contact Sales</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} GrainFlow. All rights reserved.</p>
        <p>Built with ❤️ for Indian Farmers and Warehouse Owners.</p>
      </div>
    </footer>
  )
}
