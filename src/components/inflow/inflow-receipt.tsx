'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { PrintButton } from '../common/print-button';
import { toDate } from '@/lib/utils';

interface InflowReceiptProps {
    record: StorageRecord;
    customer: Customer;
    warehouse: any;
}

export function InflowReceipt({ record, customer, warehouse }: InflowReceiptProps) {
    const router = useRouter();
    const [formattedDate, setFormattedDate] = useState('');

    useEffect(() => {
        const startDate = toDate(record.storageStartDate);
        setFormattedDate(format(startDate, 'dd/MM/yy'));
    }, [record.storageStartDate]);

    // Custom HandlePrint removed in favor of PrintButton, but we keep the view below primarily for user satisfaction "I see the receipt".
    // Actually the user view is just the React generic view.
    // The ReceiptTemplate is what gets printed.

    return (
        <div className="w-full max-w-2xl mx-auto bg-background p-4 sm:p-6">
            <div className="bg-white p-6 border-2 border-blue-800 font-mono text-sm">
                <div className="text-center mb-4">
                    <div className="text-xs">Cell: {warehouse?.phone || '9703503423, 9160606633'}</div>
                    <h1 className="text-2xl font-bold text-blue-900">{warehouse?.name?.toUpperCase() || 'SRI LAKSHMI WAREHOUSE'}</h1>
                    <p className="text-xs">{warehouse?.location || 'Survey No. 165,237/2, Owk - Koilakuntla Road, OWK - 518 122'}</p>
                    {warehouse?.email && <p className="text-xs">{warehouse.email}</p>}
                </div>
                
                <div className="flex justify-between items-center mb-2">
                    <h2 className="font-bold underline">GODOWN RECEIPT</h2>
                </div>

                <div className="flex justify-between items-baseline mb-4">
                    <div><span className="font-bold">Receipt #</span> {record.recordNumber || record.id}</div>
                    <div><span className="font-bold">Date:</span> {formattedDate}</div>
                </div>

                <div className="space-y-2">
                    <div className="flex">
                        <span className="w-1/3 font-bold">LORRY / TRACTOR No.</span>
                        <span>: {record.lorryTractorNo || 'N/A'}</span>
                    </div>
                    <div className="flex">
                        <span className="w-1/3 font-bold">NAME OF THE FARMER</span>
                        <span>: {customer.name}</span>
                    </div>
                    {customer.fatherName && (
                        <div className="flex">
                            <span className="w-1/3 font-bold">FATHER'S NAME</span>
                            <span>: {customer.fatherName}</span>
                        </div>
                    )}
                    <div className="flex">
                        <span className="w-1/3 font-bold">VILLAGE</span>
                        <span>: {customer.village || 'N/A'}</span>
                    </div>
                    {record.inflowType === 'transfer_in' && (
                        <div className="flex">
                            <span className="w-1/3 font-bold">PLOT BAGS</span>
                            <span>: {record.plotBags}</span>
                        </div>
                    )}
                    <div className="flex">
                        <span className="w-1/3 font-bold">COMMODITY</span>
                        <span>: {record.commodityDescription || 'N/A'}</span>
                    </div>
                    <div className="flex">
                        <span className="w-1/3 font-bold">NO. OF BAGS</span>
                        <span>: {record.bagsStored}</span>
                    </div>
                    <div className="flex">
                        <span className="w-1/3 font-bold">LOT NO.</span>
                        <span>: {record.location || 'N/A'}</span>
                    </div>
                    {(() => {
                        const hamaliPayable = Number(record.hamaliPayable || 0);
                        // Inflow payments are hamali-only (recorded at inflow time).
                        // Sum all 'hamali' payments for this record; fall back to summing all
                        // payments if type isn't set (legacy records).
                        const payments = record.payments || [];
                        const typedHamali = payments
                            .filter((p: any) => p.type === 'hamali')
                            .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
                        const hamaliPaid = typedHamali > 0
                            ? typedHamali
                            : payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
                        const hamaliPending = Math.max(0, hamaliPayable - hamaliPaid);
                        const hasPaid = hamaliPaid > 0;

                        return (
                            <>
                                <div className="flex">
                                    <span className="w-1/3 font-bold">HAMALI PAYABLE</span>
                                    <span>: ₹{hamaliPayable}</span>
                                </div>
                                {hasPaid && (
                                    <>
                                        <div className="flex">
                                            <span className="w-1/3 font-bold">HAMALI PAID</span>
                                            <span>: ₹{hamaliPaid}</span>
                                        </div>
                                        <div className="flex">
                                            <span className="w-1/3 font-bold">HAMALI PENDING</span>
                                            <span>: ₹{hamaliPending}</span>
                                        </div>
                                    </>
                                )}
                            </>
                        );
                    })()}
                    {Number(record.insurancePayable || 0) > 0 && (
                        <div className="flex">
                            <span className="w-1/3 font-bold">INSURANCE PAYABLE</span>
                            <span>: ₹{Number(record.insurancePayable || 0)}</span>
                        </div>
                    )}
                    {record.notes && (
                        <div className="flex">
                            <span className="w-1/3 font-bold">NOTES</span>
                            <span>: {record.notes}</span>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="mt-6 flex justify-center gap-4">
                <PrintButton 
                    data={{
                        ...record,
                        customerName: customer.name,
                        commodityDescription: record.commodityDescription || 'N/A',
                        bagsIn: record.bagsStored,
                        // Warehouse Info
                        warehouseName: warehouse?.name,
                        warehouseAddress: warehouse?.location,
                        gstNo: warehouse?.gst_number,
                    }} 
                    type="inflow" 
                    buttonText="Print / Download PDF"
                    variant="default"
                />
                
                <Button onClick={() => router.push('/inflow')} variant="outline">
                    Done
                </Button>
            </div>
        </div>
    );
}
