import { AppLayout } from '@/components/layout/app-layout';
import { WarehouseProvider } from '@/contexts/warehouse-context';
import { CustomerProvider } from '@/contexts/customer-context';
import { StaticDataProvider } from '@/hooks/use-static-data';
import { AuthListener } from '@/components/auth/auth-listener';
import { LoadingProvider } from '@/components/providers/loading-provider';

import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { OnboardingTour } from '@/components/onboarding/onboarding-tour';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.user_metadata?.role === 'customer') {
    redirect('/portal');
  }

  let tourCompleted = false;

  if (user) {
      const { data: profile } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', user.id)
          .single();

      tourCompleted = profile?.preferences?.tourCompleted || false;
  }

  return (
    <WarehouseProvider>
      <StaticDataProvider>
        <CustomerProvider>
          <AuthListener />
          <OnboardingTour tourCompleted={tourCompleted} />
          <LoadingProvider>
            <AppLayout>
                {children}
            </AppLayout>
          </LoadingProvider>
        </CustomerProvider>
      </StaticDataProvider>
    </WarehouseProvider>
  );
}
