
'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { format } from 'date-fns';
import { formatCurrency, toDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { DateRange } from 'react-day-picker';

type CustomerStatementReceiptProps = {
  customer: Customer;
  records: StorageRecord[];
  dateRange?: DateRange;
};

export const CustomerStatementReceipt = React.forwardRef<HTMLDivElement, CustomerStatementReceiptProps>(
  ({ customer, records, dateRange }, ref) => {
    const [formattedDate, setFormattedDate] = useState('');
    const [totals, setTotals] = useState({
      rent: 0,
      hamali: 0,
      insurance: 0,
      billed: 0,
      paid: 0,
      balance: 0,
    });

    useEffect(() => {
        setFormattedDate(format(new Date(), 'dd MMM yyyy'));

        let totalRent = 0;
        let totalHamali = 0;
        let totalInsurance = 0;
        let totalPaid = 0;

        records.forEach(r => {
            totalRent += r.totalRentBilled || 0;
            totalHamali += r.hamaliPayable || 0;
            totalInsurance += (r as any).insurancePayable || 0;
            const payments = r.payments || [];
            totalPaid += payments.reduce((sum, p) => sum + p.amount, 0);
        });

        const totalBilled = totalRent + totalHamali + totalInsurance;

        setTotals({
            rent: totalRent,
            hamali: totalHamali,
            insurance: totalInsurance,
            billed: totalBilled,
            paid: totalPaid,
            balance: totalBilled - totalPaid
        });

    }, [records]);

    return (
        <div ref={ref} className="printable-area bg-white p-4">
            <Card className="w-full shadow-none border-0">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">SRI LAKSHMI WAREHOUSE</CardTitle>
                    <p className='text-sm text-muted-foreground'>MOBILE NO 9160606633</p>
                    <CardDescription>Customer Statement</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                            <h3 className="font-semibold mb-2">Customer Details</h3>
                            <p className="font-medium text-lg">{customer.name}</p>
                            {customer.fatherName && <p>S/o {customer.fatherName}</p>}
                            <p>{customer.village || customer.address}</p>
                            <p>Phone: {customer.phone}</p>
                        </div>
                         <div className="text-left sm:text-right">
                            <h3 className="font-semibold mb-2">Statement Details</h3>
                            <p><span className="font-medium">Date:</span> {formattedDate}</p>
                            {dateRange?.from && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    Period: {format(dateRange.from, 'dd/MM/yy')} - {dateRange.to ? format(dateRange.to, 'dd/MM/yy') : '...'}
                                </p>
                            )}
                            <p><span className="font-medium">Total Records:</span> {records.length}</p>
                        </div>
                    </div>

                    <Separator />

                    {/* Summary Box */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg border">
                        <div className="text-center">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Total Rent</p>
                            <p className="text-lg font-bold">{formatCurrency(totals.rent)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Total Hamali</p>
                            <p className="text-lg font-bold">{formatCurrency(totals.hamali)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Total Paid</p>
                            <p className="text-lg font-bold text-green-600">{formatCurrency(totals.paid)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Balance Due</p>
                            <p className={`text-lg font-bold ${totals.balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                {formatCurrency(totals.balance)}
                            </p>
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <h3 className="font-semibold text-sm mb-3">Detailed Stock Register</h3>
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Record #</TableHead>
                                    <TableHead>Date In</TableHead>
                                    <TableHead>Commodity</TableHead>
                                    <TableHead className="text-right">Bags</TableHead>
                                    <TableHead className="text-right">Billed</TableHead>
                                    <TableHead className="text-right">Paid</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records.map((r) => {
                                    const payments = r.payments || [];
                                    const paid = payments.reduce((sum, p) => sum + p.amount, 0);
                                    const billed = (r.totalRentBilled || 0) + (r.hamaliPayable || 0) + (((r as any).insurancePayable) || 0);
                                    const balance = billed - paid;

                                    return (
                                        <TableRow key={r.id}>
                                            <TableCell className="font-medium font-mono">{r.recordNumber || r.id.substring(0, 8)}</TableCell>
                                            <TableCell>{format(toDate(r.storageStartDate), 'dd MMM yyyy')}</TableCell>
                                            <TableCell>{r.commodityDescription || '-'}</TableCell>
                                            <TableCell className="text-right">{r.bagsStored}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(billed)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(paid)}</TableCell>
                                            <TableCell className={`text-right ${balance > 0 ? 'font-medium text-destructive' : ''}`}>
                                                {formatCurrency(balance)}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={4} className="text-right font-bold">Totals</TableCell>
                                    <TableCell className="text-right font-bold hover:bg-muted/50">{formatCurrency(totals.billed)}</TableCell>
                                    <TableCell className="text-right font-bold hover:bg-muted/50">{formatCurrency(totals.paid)}</TableCell>
                                    <TableCell className="text-right font-bold hover:bg-muted/50">{formatCurrency(totals.balance)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                    
                    <Separator />
            
                    <div className="mt-16 pt-8 flex justify-between text-center text-sm">
                        <div className="w-1/3">
                            <div className="border-t border-gray-400 mx-4 pt-2">Manager Signature</div>
                        </div>
                        <div className="w-1/3">
                             <div className="border-t border-gray-400 mx-4 pt-2">Customer Signature</div>
                        </div>
                    </div>

                    <div className="text-xs text-muted-foreground text-center pt-6">
                        <p>This is a computer-generated statement.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }
);

CustomerStatementReceipt.displayName = 'CustomerStatementReceipt';
