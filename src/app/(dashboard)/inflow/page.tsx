import { PageHeader } from "@/components/shared/page-header";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { getRecentInflows } from "@/lib/queries";
import { isSMSEnabled } from "@/lib/sms-settings-actions";
import { getUnloadedInventory } from "@/lib/unloading-actions";
import { createClient } from "@/utils/supabase/server";
import { getUserWarehouse } from "@/lib/queries/warehouses";
import { InflowDashboard } from "./inflow-dashboard";


export const dynamic = 'force-dynamic';
export const revalidate = 30; // Revalidate every 30 seconds for high-frequency updates

export const metadata = {
  title: 'Inflow',
  description: 'Record new stock arrivals and manage gate entries.',
};

export default async function InflowPage() {
    const supabase = await createClient();
    const warehouseId = await getUserWarehouse();
    
    // Parallel fetching for all data
    const [records, unloadedRecords, smsEnabled, customersRaw, crops, lots] = await Promise.all([
        getRecentInflows(100),
        getUnloadedInventory(),
        isSMSEnabled('inflow_welcome'),
        supabase
            .from('customers')
            .select('id, name, father_name, village')
            .eq('warehouse_id', warehouseId)
            .is('deleted_at', null)
            .order('name')
            .then(res => res.data || []),
        supabase
            .from('crops')
            .select('id, name')
            .eq('warehouse_id', warehouseId)
            .order('name')
            .then(res => res.data || []),
        supabase
            .from('warehouse_lots')
            .select('id, name, capacity, current_stock')
            .eq('warehouse_id', warehouseId)
            .eq('status', 'active')
            .order('name', { ascending: true })
            .then(res => res.data || [])
    ]);
    
    const nextSerialNumber = "Auto-Generated";
    
    const customers = customersRaw.map((c: any) => ({
        id: c.id,
        name: c.name,
        fatherName: c.father_name || '',
        village: c.village || ''
    }));

  return (
    <>
      <PageHeader
        title="Inflow Management"
        description="Record truck arrivals and manage storage inflows."
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Inflow' }
        ]}
      >
        <AddCustomerDialog />
      </PageHeader>
      
      <InflowDashboard 
          initialInflows={records}
          nextSerialNumber={nextSerialNumber}
          smsEnabled={smsEnabled}
          customers={customers || []}
          crops={crops || []}
          lots={lots || []}
          unloadedRecords={unloadedRecords}
      />
    </>
  );
}
