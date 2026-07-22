'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import type { BulkOutflowBatchData } from '@/lib/queries/bulk-outflow-batch';

type Props = { batch: BulkOutflowBatchData };

/**
 * Printable consolidated bulk-outflow bill. One bill covering N record
 * slices, ONE invoice number.
 */
export function BulkOutflowReceipt({ batch }: Props) {
    const [withdrawalDateStr, setWithdrawalDateStr] = useState('');
    const [printedAt, setPrintedAt] = useState('');

    useEffect(() => {
        setWithdrawalDateStr(format(batch.withdrawalDate, 'dd MMM yyyy'));
        setPrintedAt(format(new Date(), 'dd MMM yyyy, hh:mm a'));
    }, [batch.withdrawalDate]);

    return (
        <div className="printable-area bg-white p-6 max-w-3xl mx-auto">
            <Card className="border-0 shadow-none">
                <CardHeader className="text-center pb-4">
                    <h1 className="text-2xl font-bold uppercase tracking-wide">
                        {batch.warehouse?.name || 'Warehouse'}
                    </h1>
                    {batch.warehouse?.location && (
                        <p className="text-sm text-muted-foreground">{batch.warehouse.location}</p>
                    )}
                    {batch.warehouse?.phone && (
                        <p className="text-sm text-muted-foreground">Phone: {batch.warehouse.phone}</p>
                    )}
                    {batch.warehouse?.gstNumber && (
                        <p className="text-xs text-muted-foreground">GST: {batch.warehouse.gstNumber}</p>
                    )}
                    <p className="text-base font-semibold uppercase tracking-wider mt-2">Outflow Bill (all lots)</p>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Header strip */}
                    <div className="grid grid-cols-2 gap-4 text-sm border rounded p-3 bg-muted/30">
                        <div>
                            <div className="text-xs text-muted-foreground uppercase">Bill #</div>
                            <div className="font-mono font-bold text-base">{batch.invoiceNo}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-muted-foreground uppercase">Date</div>
                            <div className="font-semibold">{withdrawalDateStr}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground uppercase">Customer</div>
                            <div className="font-semibold">{batch.customer.name}</div>
                            {batch.customer.fatherName && (
                                <div className="text-xs text-muted-foreground">S/o {batch.customer.fatherName}</div>
                            )}
                            {batch.customer.village && (
                                <div className="text-xs text-muted-foreground">{batch.customer.village}</div>
                            )}
                            {batch.customer.phone && (
                                <div className="text-xs text-muted-foreground">Phone: {batch.customer.phone}</div>
                            )}
                            {batch.customer.customerNumber != null && (
                                <div className="text-xs text-muted-foreground font-mono">Customer ID: {batch.customer.customerNumber}</div>
                            )}
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-muted-foreground uppercase">Commodity</div>
                            <div className="font-semibold">{batch.commodity}</div>
                        </div>
                    </div>

                    {/* Per-record breakdown */}
                    <div>
                        <h3 className="font-semibold text-sm mb-2">Outflow Breakdown</h3>
                        <table className="w-full text-sm border">
                            <thead className="bg-muted/40">
                                <tr>
                                    <th className="text-left p-2 border-b">Record #</th>
                                    <th className="text-left p-2 border-b">Location</th>
                                    <th className="text-left p-2 border-b">Stored Since</th>
                                    <th className="text-right p-2 border-b">Bags</th>
                                    <th className="text-right p-2 border-b">Rent (₹)</th>
                                    <th className="text-center p-2 border-b">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {batch.slices.map((s) => (
                                    <tr key={s.withdrawalId} className="border-b last:border-b-0">
                                        <td className="p-2 font-mono">#{s.recordNumber ?? '—'}</td>
                                        <td className="p-2">{s.location || '—'}</td>
                                        <td className="p-2 text-xs">{format(s.storageStartDate, 'dd MMM yyyy')}</td>
                                        <td className="p-2 text-right font-medium">{s.bagsTaken}</td>
                                        <td className="p-2 text-right">{formatCurrency(s.rentCollected)}</td>
                                        <td className="p-2 text-center">
                                            {s.isClosed ? (
                                                <span className="inline-block text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded">CLOSED</span>
                                            ) : (
                                                <span className="inline-block text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded">PARTIAL</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-muted/40 font-semibold">
                                    <td className="p-2" colSpan={3}>Total</td>
                                    <td className="p-2 text-right">{batch.totals.totalBags}</td>
                                    <td className="p-2 text-right">{formatCurrency(batch.totals.totalRent)}</td>
                                    <td className="p-2"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <Separator />

                    {/* Totals panel */}
                    <div className="grid grid-cols-2 gap-y-2 text-sm max-w-md ml-auto">
                        <div>Storage rent</div>
                        <div className="text-right font-medium">{formatCurrency(batch.totals.totalRent)}</div>

                        {batch.totals.totalHamali > 0 && (
                            <>
                                <div>Hamali (on closed records)</div>
                                <div className="text-right font-medium">{formatCurrency(batch.totals.totalHamali)}</div>
                            </>
                        )}

                        {batch.totals.totalInsurance > 0 && (
                            <>
                                <div>Insurance (on closed records)</div>
                                <div className="text-right font-medium">{formatCurrency(batch.totals.totalInsurance)}</div>
                            </>
                        )}

                        {batch.totals.totalDiscount > 0 && (
                            <>
                                <div className="text-muted-foreground">Discount applied</div>
                                <div className="text-right font-medium text-muted-foreground">- {formatCurrency(batch.totals.totalDiscount)}</div>
                            </>
                        )}

                        <div className="font-semibold border-t pt-2">Total to pay</div>
                        <div className="text-right font-semibold border-t pt-2">{formatCurrency(batch.totals.totalBilled)}</div>

                        {batch.totals.totalPaidOnDate > 0 && (
                            <>
                                <div className="text-emerald-700">Paid now</div>
                                <div className="text-right font-medium text-emerald-700">- {formatCurrency(batch.totals.totalPaidOnDate)}</div>
                            </>
                        )}

                        <div className="font-bold text-base border-t pt-2">Still to pay (this bill)</div>
                        <div className={`text-right font-bold text-base border-t pt-2 ${batch.totals.balance > 0 ? 'text-destructive' : 'text-emerald-700'}`}>
                            {formatCurrency(batch.totals.balance)}
                        </div>

                        {batch.totals.pendingDues > 0 && (
                            <>
                                <div className="text-destructive border-t pt-2">Total still owed (all these lots)</div>
                                <div className="text-right font-semibold text-destructive border-t pt-2">
                                    {formatCurrency(batch.totals.pendingDues)}
                                </div>
                                <div className="col-span-2 text-[11px] text-muted-foreground">
                                    Includes any unpaid rent, hamali or insurance still owed on these lots.
                                </div>
                            </>
                        )}
                    </div>

                    <Separator />

                    {/* Footer */}
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Printed: {printedAt}</span>
                        <span>Records in batch: {batch.slices.length}</span>
                    </div>
                </CardContent>
            </Card>

            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
                }
            `}</style>
        </div>
    );
}
