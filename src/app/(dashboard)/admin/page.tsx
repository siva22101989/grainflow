import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Building2, Users, Activity, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { 
    getAdminDashboardStats, 
    getAllWarehousesAdmin, 
    getAllUsersAdmin, 
    getGlobalActivityLogs,
    getPlatformAnalytics
} from '@/lib/queries';

import { AdminStatsCards } from '@/components/admin/stats-cards';
import { AdminWarehousesTable } from '@/components/admin/warehouses-table';
import { AdminUsersTable } from '@/components/admin/users-table';
// import { GlobalActivityFeed } from '@/components/admin/activity-feed'; // Replaced
import { ActivityLogsTable } from '@/components/admin/activity-logs-table';
import { AnalyticsSection } from '@/components/admin/analytics-section';
import { getAdminAllSubscriptions, getAllPlans } from '@/lib/subscription-actions';
import { getAllSubscriptionCodes } from '@/lib/subscription-code-actions';
import { CodeGenerator } from '@/components/admin/code-generator';
import { CreateWarehouseDialog } from '@/components/admin/create-warehouse-dialog';
import { SubscriptionsTable } from '@/components/admin/subscriptions-table';
import { CodesTable } from '@/components/admin/codes-table';
import { CreditCard, Key } from 'lucide-react';
import { UserRole } from '@/types/db';
export default async function SuperAdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : '';
  const page = typeof params.page === 'string' ? Number(params.page) : 1;
  const type = typeof params.type === 'string' ? params.type : 'important';
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // 1. Strict Role Check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Admin Panel is platform-level: only SUPER_ADMIN can access.
  // Owners are tenant-level — their warehouse management lives in /settings.
  // (Allowing OWNER here previously leaked other tenants' subscriptions/codes/etc.)
  if (profile?.role !== UserRole.SUPER_ADMIN) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-50">
            <h1 className="text-4xl font-bold text-slate-800">403 Forbidden</h1>
            <p className="text-slate-600">You do not have permission to access the Mainframe.</p>
            <Button asChild variant="outline">
                <Link href="/">Return to Dashboard</Link>
            </Button>
        </div>
      );
  }

  // 2. Fetch Initial Platform Data
  const stats = await getAdminDashboardStats();
  const warehouses = await getAllWarehousesAdmin();
  const users = await getAllUsersAdmin();
  const analyticsData = await getPlatformAnalytics();
  
  // Fetch Subscription Data
  const subscriptions = await getAdminAllSubscriptions();
  const plans = await getAllPlans();
  const allCodes = await getAllSubscriptionCodes();

  // Fetch Logs with Filters
  const limit = 50;
  const offset = (page - 1) * limit;
  const activityLogs = await getGlobalActivityLogs(limit, offset, q, type);

  if (!stats) return <div>Failed to load stats</div>;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">
      <PageHeader
        title="Admin Panel"
        description={`Managing ${stats.warehouseCount} warehouses with ${stats.usersCount} active users.`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Admin Panel' }
        ]}
      >
        <CreateWarehouseDialog />
      </PageHeader>

      <AdminStatsCards stats={stats} />

      <Tabs defaultValue="warehouses" className="space-y-4 sm:space-y-6 overflow-hidden">
        <div className="flex items-center justify-between pb-1 border-b border-primary/10 -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="bg-transparent h-auto p-0 gap-2 md:gap-6 justify-start flex-wrap w-full">
            <TabsTrigger 
              value="warehouses" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-indigo-600 border-b-2 border-transparent rounded-none px-1 py-3 h-auto font-semibold text-sm whitespace-nowrap flex-grow basis-[45%] md:basis-auto"
            >
              <Building2 className="mr-2 h-4 w-4" /> 
              Warehouses
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-indigo-600 border-b-2 border-transparent rounded-none px-1 py-3 h-auto font-semibold text-sm whitespace-nowrap flex-grow basis-[45%] md:basis-auto"
            >
              <Users className="mr-2 h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger 
              value="activity" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-indigo-600 border-b-2 border-transparent rounded-none px-1 py-3 h-auto font-semibold text-sm whitespace-nowrap flex-grow basis-[45%] md:basis-auto"
            >
              <Activity className="mr-2 h-4 w-4" /> Audit Logs
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-indigo-600 border-b-2 border-transparent rounded-none px-1 py-3 h-auto font-semibold text-sm whitespace-nowrap flex-grow basis-[45%] md:basis-auto"
            >
              <BarChart3 className="mr-2 h-4 w-4" /> Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="subscriptions" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-indigo-600 border-b-2 border-transparent rounded-none px-1 py-3 h-auto font-semibold text-sm whitespace-nowrap flex-grow basis-[45%] md:basis-auto"
            >
              <CreditCard className="mr-2 h-4 w-4" /> Subscriptions
            </TabsTrigger>
            <TabsTrigger 
              value="codes" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-indigo-600 border-b-2 border-transparent rounded-none px-1 py-3 h-auto font-semibold text-sm whitespace-nowrap flex-grow basis-[45%] md:basis-auto"
            >
              <Key className="mr-2 h-4 w-4" /> Codes
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="warehouses" className="mt-0 space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold tracking-tight">Platform Warehouses</h3>
          </div>
          <AdminWarehousesTable warehouses={warehouses} />
        </TabsContent>

        <TabsContent value="users" className="mt-0 space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold tracking-tight">User Directory</h3>
          </div>
          <AdminUsersTable users={users} />
        </TabsContent>

        <TabsContent value="activity" className="mt-0 pt-4">
          <Card className="border-none shadow-none bg-transparent">
            <div className="mb-4">
              <h3 className="text-lg font-semibold tracking-tight">Global Audit Log</h3>
              <p className="text-sm text-muted-foreground">Latest actions from all users across the platform.</p>
            </div>
            <ActivityLogsTable logs={activityLogs} />
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-0 pt-4">
          <AnalyticsSection data={analyticsData} />
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-0 pt-4">
             <div className="mb-4">
              <h3 className="text-lg font-semibold tracking-tight">Subscription Management</h3>
              <p className="text-sm text-muted-foreground">Manually manage warehouse plans and expiry dates.</p>
            </div>
            <SubscriptionsTable initialData={subscriptions} plans={plans} />
        </TabsContent>

        <TabsContent value="codes" className="mt-0 pt-4">
             <div className="mb-4">
              <h3 className="text-lg font-semibold tracking-tight">Activation Codes</h3>
              <p className="text-sm text-muted-foreground">Generate and manage manual activation codes.</p>
            </div>
            <div className="flex justify-end mb-4">
                <CodeGenerator plans={plans} />
            </div>
            <CodesTable codes={allCodes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

