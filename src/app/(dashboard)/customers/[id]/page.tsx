
import { getCustomer, getCustomerRecords, getAvailableCrops } from '@/lib/queries';
import { notFound } from 'next/navigation';
import { CustomerDetailsClient } from './customer-details-client';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [customer, records, crops] = await Promise.all([
        getCustomer(id),
        getCustomerRecords(id),
        getAvailableCrops()
    ]);

    if (!customer) {
        notFound();
    }

    return <CustomerDetailsClient customer={customer} initialRecords={records} crops={crops} />;
}
