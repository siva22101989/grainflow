
'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { format } from 'date-fns';
import { getRecordStatus, type RecordStatusInfo } from '@/lib/billing';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';

type BillReceiptProps = {
  record: StorageRecord;
  customer: Customer;
};

export const BillReceipt = React.forwardRef<HTMLDivElement, BillReceiptProps>(
  ({ record, customer }, ref) => {
    const [statusInfo, setStatusInfo] = useState<RecordStatusInfo | null>(null);
    const [formattedBillDate, setFormattedBillDate] = useState('');
    const [paymentInfo, setPaymentInfo] = useState({ paid: 0, balance: 0 });

    useEffect(() => {
        const safeRecord = {
            ...record,
            storageStartDate: toDate(record.storageStartDate),
            storageEndDate: record.storageEndDate ? toDate(record.storageEndDate) : null,
        }
        // Hydration safety
        setStatusInfo(getRecordStatus(safeRecord));
        setFormattedBillDate(format(new Date(), 'dd MMM yyyy'));
        
        const totalPaid = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
        const totalBilled =
            record.hamaliPayable +
            (record.totalRentBilled || 0) +
            ((record as any).insurancePayable || 0);
        setPaymentInfo({
            paid: totalPaid,
            balance: totalBilled - totalPaid,
        });

    }, [record]);

    if (!statusInfo) return null;

    return (
        <div ref={ref} className="printable-area bg-white p-4">
            <Card className="w-full shadow-none border-0">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">SRI LAKSHMI WAREHOUSE</CardTitle>
                    <p className='text-sm text-muted-foreground'>MOBILE NO 9160606633</p>
                    <CardDescription>Billing Statement</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <h3 className="font-semibold mb-2">Customer Details</h3>
                            <p>{customer.name}</p>
                            {customer.fatherName && <p>S/o {customer.fatherName}</p>}
                            <p>{customer.village || customer.address}</p>
                            <p>Phone: {customer.phone}</p>
                        </div>
                         <div>
                            <h3 className="font-semibold mb-2">Billing Details</h3>
                            <p><span className="font-medium">Bill Date:</span> {formattedBillDate}</p>
                            <p><span className="font-medium">Record #:</span> {record.recordNumber || record.id}</p>
                            <p><span className="font-medium">Commodity:</span> {record.commodityDescription}</p>
                        </div>
                    </div>

                    <Separator />

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">No.</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell>1</TableCell>
                                <TableCell>{record.commodityDescription}</TableCell>
                                <TableCell className="text-right">{record.bagsStored} bags</TableCell>
                                <TableCell className="text-right">-</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>2</TableCell>
                                <TableCell>Hamali Charges</TableCell>
                                <TableCell className="text-right">-</TableCell>
                                <TableCell className="text-right">{formatCurrency(record.hamaliPayable)}</TableCell>
                            </TableRow>
                             {record.totalRentBilled > 0 && (
                                <TableRow>
                                    <TableCell>3</TableCell>
                                    <TableCell>Rent Charges</TableCell>
                                    <TableCell className="text-right">-</TableCell>
                                    <TableCell className="text-right">{formatCurrency(record.totalRentBilled)}</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={3} className="text-right font-bold">Total Billed</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(record.hamaliPayable + (record.totalRentBilled || 0) + (((record as any).insurancePayable) || 0))}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                    
                    <Separator />

                    {/* Payment History Section */}
                    {record.payments && record.payments.length > 0 && (
                        <div className="mt-6 mb-6">
                            <h3 className="font-semibold text-sm mb-3">Payment History</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Date</TableHead>
                                        <TableHead>Reference / Type</TableHead>
                                        <TableHead>Notes</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {record.payments.map((payment, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{format(toDate(payment.date), 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="capitalize">
                                                {payment.paymentNumber ? `#${payment.paymentNumber} • ` : ''} 
                                                {payment.type || 'Payment'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                                                {payment.notes || '-'}
                                            </TableCell>
                                            <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    
                    <Separator />
                    
                    <div className="flex justify-end">
                        <div className="w-full max-w-xs space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount Paid</span>
                                <span>{formatCurrency(paymentInfo.paid)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-base">
                                <span>Balance Due</span>
                                <span className={paymentInfo.balance > 0 ? 'text-destructive' : ''}>{formatCurrency(paymentInfo.balance)}</span>
                            </div>
                        </div>
                    </div>


                    <div className="mt-20 pt-10 flex justify-between text-center text-sm">
                        <div className="w-1/2">
                            <div className="border-t border-gray-400 mx-4 pt-2">Manager Signature</div>
                        </div>
                        <div className="w-1/2">
                             <div className="border-t border-gray-400 mx-4 pt-2">Customer Signature</div>
                        </div>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-2 pt-6">
                       <p>
                            <strong>Note:</strong>
                            This statement reflects the current status of the active storage record. For withdrawals, final rent will be calculated based on the withdrawal date.
                        </p>
                        <p>This is a computer-generated document and does not require a signature.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }
);

BillReceipt.displayName = 'BillReceipt';
