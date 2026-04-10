import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/shared/print-button";
import Link from "next/link";
import { X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { OutflowReceipt } from "@/components/outflow/outflow-receipt";
import { getStorageRecord, getCustomer, getWarehouseDetails, getAvailableCrops } from "@/lib/queries";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function OutflowReceiptPage({ 
    params, 
    searchParams 
}: { 
    params: Promise<{ recordId: string }>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { recordId } = await params;
  const resolvedSearchParams = await searchParams;
  
  const withdrawnBags = Number(resolvedSearchParams?.withdrawn) || 0;
  const finalRent = Number(resolvedSearchParams?.rent) || 0;
  const paidNow = Number(resolvedSearchParams?.paidNow) || 0;

  const [record, warehouse, crops] = await Promise.all([
    getStorageRecord(recordId),
    getWarehouseDetails(),
    getAvailableCrops()
  ]);

  const customer = record ? await getCustomer(record.customerId) : null;

  if (!record || !customer) {
    notFound();
  }
  
  return (
    <>
      <PageHeader
        title="Outflow Receipt"
        description={`Final bill for storage record ${record.outflowInvoiceNo || record.id}`}
      >
        <PrintButton />
        <Button asChild variant="outline" size="sm" className="print:hidden gap-2">
            <Link href="/outflow">
                <X className="h-4 w-4" /> Close
            </Link>
        </Button>
      </PageHeader>
      <div className="flex justify-center">
        <OutflowReceipt
            record={record}
            customer={customer}
            withdrawnBags={withdrawnBags}
            finalRent={finalRent}
            paidNow={paidNow}
            warehouse={warehouse}
            crops={crops}
        />
      </div>
    </>
  );
}
