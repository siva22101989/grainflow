
'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
      bagsIn: 0,
      bagsOut: 0,
      balanceStock: 0,
    });

    useEffect(() => {
        setFormattedDate(format(new Date(), 'dd MMM yyyy'));

        let totalRent = 0;
        let totalHamali = 0;
        let totalInsurance = 0;
        let totalPaid = 0;
        let bagsIn = 0, bagsOut = 0, balanceStock = 0;

        records.forEach(r => {
            totalRent += r.totalRentBilled || 0;
            totalHamali += r.hamaliPayable || 0;
            totalInsurance += (r as any).insurancePayable || 0;
            const payments = r.payments || [];
            totalPaid += payments.reduce((sum, p) => sum + p.amount, 0);
            bagsIn += r.bagsIn || 0;
            bagsOut += r.bagsOut || 0;
            balanceStock += r.bagsStored || 0;
        });

        const totalBilled = totalRent + totalHamali + totalInsurance;

        setTotals({
            rent: totalRent,
            hamali: totalHamali,
            insurance: totalInsurance,
            billed: totalBilled,
            paid: totalPaid,
            balance: totalBilled - totalPaid,
            bagsIn,
            bagsOut,
            balanceStock,
        });

    }, [records]);

    // Build chronological ledger: inflow events + bulk-grouped outflows +
    // payments, sorted by date with running balance. Bulk batches
    // (consolidatedInvoiceNo NOT null) collapse to one parent entry with
    // per-record slice children visible underneath.
    type LedgerEntry = {
        date: Date;
        kind: 'inflow' | 'outflow' | 'payment';
        description: string;
        invoiceNo: string;
        bagsIn?: number;
        bagsOut?: number;
        rent?: number;
        hamali?: number;
        insurance?: number;
        credit?: number;
        slices?: { recordNumber?: string | null; bagsOut: number; rent: number }[];
    };

    const ledger = useMemo<LedgerEntry[]>(() => {
        const out: LedgerEntry[] = [];

        // Inflows + payments — one entry per record / per payment
        records.forEach(r => {
            out.push({
                date: toDate(r.storageStartDate),
                kind: 'inflow',
                description: `Inflow - ${r.commodityDescription || 'Storage'}`,
                invoiceNo: r.recordNumber || r.id.substring(0, 8),
                bagsIn: r.bagsIn,
                hamali: r.hamaliPayable || 0,
                insurance: (r as any).insurancePayable || 0,
            });
            (r.payments || []).forEach((p) => {
                out.push({
                    date: toDate(p.date),
                    kind: 'payment',
                    description: `Payment - ${p.type || 'general'}`,
                    invoiceNo: r.recordNumber || r.id.substring(0, 8),
                    credit: p.amount,
                });
            });
        });

        // Withdrawals: flatten across records, then group by consolidatedInvoiceNo
        type WT = { record: StorageRecord; w: NonNullable<StorageRecord['withdrawals']>[number] };
        const allWds: WT[] = [];
        records.forEach(r => {
            (r.withdrawals || []).forEach(w => allWds.push({ record: r, w }));
        });

        const batches = new Map<string, WT[]>();
        const singletons: WT[] = [];
        for (const wt of allWds) {
            const key = wt.w.consolidatedInvoiceNo;
            if (!key) singletons.push(wt);
            else {
                const list = batches.get(key) || [];
                list.push(wt);
                batches.set(key, list);
            }
        }

        for (const [invoiceNo, slices] of batches.entries()) {
            const totalBags = slices.reduce((s, sl) => s + sl.w.bagsWithdrawn, 0);
            const totalRent = slices.reduce((s, sl) => s + sl.w.rentCollected, 0);
            const earliest = slices.reduce(
                (min, sl) => Math.min(min, toDate(sl.w.date).getTime()),
                Infinity
            );
            out.push({
                date: new Date(earliest),
                kind: 'outflow',
                description: `Bulk Outflow - ${slices.length} records, ${totalBags} bags`,
                invoiceNo,
                bagsOut: totalBags,
                rent: totalRent,
                slices: slices.map(sl => ({
                    recordNumber: sl.record.recordNumber,
                    bagsOut: sl.w.bagsWithdrawn,
                    rent: sl.w.rentCollected,
                })),
            });
        }

        for (const { record, w } of singletons) {
            out.push({
                date: toDate(w.date),
                kind: 'outflow',
                description: 'Outflow',
                invoiceNo: record.recordNumber || record.id.substring(0, 8),
                bagsOut: w.bagsWithdrawn,
                rent: w.rentCollected,
            });
        }

        // Sort chronologically (oldest first — running balance reads top-down)
        out.sort((a, b) => a.date.getTime() - b.date.getTime());
        return out;
    }, [records]);

    // Add running balance to each entry
    const ledgerWithBalance = useMemo(() => {
        let running = 0;
        return ledger.map(entry => {
            running += (entry.hamali || 0) + (entry.insurance || 0) + (entry.rent || 0) - (entry.credit || 0);
            return { ...entry, balance: running };
        });
    }, [ledger]);

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

                    {/* Bags Summary — physical stock movement at a glance */}
                    <div className="grid grid-cols-3 gap-4 bg-blue-50/40 dark:bg-blue-950/20 p-4 rounded-lg border">
                        <div className="text-center">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Total Bags In</p>
                            <p className="text-lg font-bold">{totals.bagsIn.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Total Bags Out</p>
                            <p className="text-lg font-bold">{totals.bagsOut.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Balance Stock</p>
                            <p className="text-lg font-bold">{totals.balanceStock.toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    {/* Money Summary */}
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

                    {/* Chronological Transactions Ledger */}
                    {ledgerWithBalance.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-sm mb-3">Transactions Ledger</h3>
                            <p className="text-xs text-muted-foreground mb-2">
                                Chronological events. Bulk outflows are shown as one bill row with the
                                affected records listed beneath.
                            </p>
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Bill / Record #</TableHead>
                                        <TableHead className="text-right">Bags In</TableHead>
                                        <TableHead className="text-right">Bags Out</TableHead>
                                        <TableHead className="text-right">Rent</TableHead>
                                        <TableHead className="text-right">Paid</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {ledgerWithBalance.map((e, idx) => (
                                        <React.Fragment key={`${e.invoiceNo}-${idx}`}>
                                            <TableRow
                                                className={
                                                    e.slices && e.slices.length > 0
                                                        ? 'bg-amber-50 font-semibold'
                                                        : e.kind === 'inflow'
                                                            ? 'bg-emerald-50/50'
                                                            : e.kind === 'payment'
                                                                ? 'bg-violet-50/50'
                                                                : ''
                                                }
                                            >
                                                <TableCell className="whitespace-nowrap">{format(toDate(e.date), 'dd MMM yyyy')}</TableCell>
                                                <TableCell>{e.description}</TableCell>
                                                <TableCell className="font-mono text-xs">{e.invoiceNo}</TableCell>
                                                <TableCell className="text-right">{e.bagsIn ?? ''}</TableCell>
                                                <TableCell className="text-right">{e.bagsOut ?? ''}</TableCell>
                                                <TableCell className="text-right">{e.rent != null ? formatCurrency(e.rent) : ''}</TableCell>
                                                <TableCell className="text-right text-emerald-700">{e.credit != null ? formatCurrency(e.credit) : ''}</TableCell>
                                                <TableCell className={`text-right font-medium ${(e as any).balance > 0 ? 'text-destructive' : 'text-emerald-700'}`}>
                                                    {formatCurrency((e as any).balance)}
                                                </TableCell>
                                            </TableRow>
                                            {e.slices && e.slices.length > 0 && e.slices.map((sl, sIdx) => (
                                                <TableRow key={`${e.invoiceNo}-slice-${sIdx}`} className="text-xs text-muted-foreground italic">
                                                    <TableCell></TableCell>
                                                    <TableCell className="pl-8">↳ Record #{sl.recordNumber ?? '—'}</TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell className="text-right">{sl.bagsOut}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(sl.rent)}</TableCell>
                                                    <TableCell></TableCell>
                                                    <TableCell></TableCell>
                                                </TableRow>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

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
