import { notFound } from 'next/navigation';
import { getBulkOutflowBatch } from '@/lib/queries/bulk-outflow-batch';
import { BulkOutflowReceipt } from '@/components/outflow/bulk-outflow-receipt';
import { PrintBatchButton } from '@/components/outflow/print-batch-button';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Consolidated Outflow Bill',
};

/**
 * Printable consolidated bulk-outflow bill, identified by the shared
 * consolidated_invoice_no. Live data — regenerates each request, so if any
 * withdrawal in the batch is reversed later, the bill reflects current state.
 */
export default async function BulkOutflowBatchPage({
    params,
}: {
    params: Promise<{ invoiceNo: string }>;
}) {
    const { invoiceNo } = await params;
    const decoded = decodeURIComponent(invoiceNo);
    const batch = await getBulkOutflowBatch(decoded);
    if (!batch) notFound();

    return (
        <div className="min-h-screen bg-background">
            {/* Toolbar (hidden on print) */}
            <div className="print:hidden border-b bg-card sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/outflow">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Outflow
                        </Link>
                    </Button>
                    <PrintBatchButton />
                </div>
            </div>

            <BulkOutflowReceipt batch={batch} />
        </div>
    );
}
