
import { getCustomerPortfolio } from '@/lib/portal-queries';
import { requireCustomerPasswordChanged } from '@/lib/portal-guards';
import { Wheat } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PortalView } from '@/components/portal/portal-view';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
    await requireCustomerPasswordChanged();
    const portfolio = await getCustomerPortfolio();

    // Check Role for Back Button (Admin Access)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let showDashboardLink = false;
    if (user) {
        // We can optimize this by checking session claim but let's stick to DB query for consistency with layout
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile && (profile.role === 'admin' || profile.role === 'manager' || profile.role === 'super_admin' || profile.role === 'owner')) {
            showDashboardLink = true;
        }
    }

    if (!portfolio || portfolio.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
                {showDashboardLink && (
                    <div className="absolute top-4 left-4">
                        <Link href="/" className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 transition-colors">
                            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Dashboard
                        </Link>
                    </div>
                )}
                <div className="p-6 bg-blue-500/10 rounded-full animate-pulse">
                    <Wheat className="h-16 w-16 text-blue-500" />
                </div>
                <div className="space-y-2">
                     <h2 className="text-2xl font-bold tracking-tight text-foreground">No Records Found</h2>
                     <p className="text-muted-foreground max-w-[300px] mx-auto">
                        Your account is linked, but no storage records (active or history) were found.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground py-8 px-4 md:px-8">
            <div className="max-w-md mx-auto md:max-w-4xl relative pb-10">
                {showDashboardLink && (
                    <div className="mb-6 md:absolute md:top-0 md:-left-32">
                        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors bg-background/50 px-3 py-1.5 rounded-full border border-border/50 backdrop-blur-sm">
                            <ArrowLeft className="mr-1 h-3 w-3" /> Dashboard
                        </Link>
                    </div>
                )}
                
                <PortalView portfolio={portfolio} currentDate={new Date()} />
            </div>
        </div>
    );
}
