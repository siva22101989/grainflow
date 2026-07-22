'use client';

import { useState, useEffect } from 'react';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { format, differenceInDays, differenceInMonths } from 'date-fns';
import { Button } from '../ui/button';
import { FileText } from 'lucide-react';
import { calculateFinalRent } from '@/lib/billing';
import { formatCurrency, toDate } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

type OutflowReceiptProps = {
  record: StorageRecord;
  customer: Customer;
  withdrawnBags: number;
  finalRent: number;
  paidNow: number;
  warehouse: any;
  crops?: any[];
};

export function OutflowReceipt({ record, customer, withdrawnBags, finalRent, paidNow, warehouse, crops }: OutflowReceiptProps) {
    const [formattedStartDate, setFormattedStartDate] = useState('');
    const [formattedEndDate, setFormattedEndDate] = useState('');
    
    const [duration, setDuration] = useState({ days: 0, months: 0 });
    const [rentBreakdown, setRentBreakdown] = useState({ rentPerBag: 0 });
    const [hamaliPending, setHamaliPending] = useState(0);
    const [advanceAmount, setAdvanceAmount] = useState(0);

    useEffect(() => {
        if (!record) return;
        const startDate = toDate(record.storageStartDate);
        const endDate = record.storageEndDate ? toDate(record.storageEndDate) : new Date();
        
        setFormattedStartDate(format(startDate, 'dd MMM yyyy'));
        setFormattedEndDate(format(endDate, 'dd MMM yyyy, hh:mm a'));

        setDuration({
            days: differenceInDays(endDate, startDate),
            months: differenceInMonths(endDate, startDate) || 1
        });

        const safeRecord = {
            ...record,
            storageStartDate: startDate,
        }

        // Look up crop pricing for correct rate display
        let pricing = undefined;
        let pricingSlabs = undefined;
        if (record.cropId && crops) {
            const crop = crops.find((c: any) => c.id === record.cropId);
            if (crop) {
                pricing = { price6m: crop.rent_price_6m, price1y: crop.rent_price_1y };
                pricingSlabs = crop.pricing_slabs || undefined;
            }
        }
        const { rentPerBag } = calculateFinalRent(safeRecord, endDate, withdrawnBags, pricing, pricingSlabs);
        setRentBreakdown({ rentPerBag });

        // record.totalRentBilled already includes finalRent because wait, OutflowReceipt is generated AFTER addOutflow updates the record!
        const totalBilledSoFar =
            record.hamaliPayable +
            Math.max(0, (record.totalRentBilled || 0) - finalRent) +
            (((record as any).insurancePayable) || 0);
        const totalPaymentsMade = (record.payments || []).reduce((acc, p) => acc + p.amount, 0);
        const priorPayments = Math.max(0, totalPaymentsMade - paidNow);

        const pending = totalBilledSoFar - priorPayments;
        
        if (pending > 0) {
            setHamaliPending(pending);
            setAdvanceAmount(0);
        } else {
            setHamaliPending(0);
            setAdvanceAmount(Math.abs(pending));
        }
        
    }, [record, withdrawnBags, paidNow, crops]);

    const totalPayable = Math.max(0, finalRent + hamaliPending - advanceAmount);
    const balanceDue = Math.max(0, totalPayable - paidNow);

    // Breakdown of the prior charges that make up "Old Balance", so
    // insurance is visible on the bill instead of hidden in one lump number.
    // priorHamali + priorInsurance + priorRent - priorPaid === hamaliPending
    // whenever hamaliPending > 0.
    const priorHamali = Number(record.hamaliPayable || 0);
    const priorInsurance = Number(record.insurancePayable || 0);
    const priorRent = Math.max(0, (record.totalRentBilled || 0) - finalRent);
    const priorPaid = Math.max(0, (record.payments || []).reduce((acc, p) => acc + p.amount, 0) - paidNow);

    // One-line breakdown behind the single "Earlier dues" figure, so the detail
    // (hamali / insurance / old rent, minus what was already paid) is still there
    // for anyone who wants it, without cluttering the main list.
    const earlierDuesParts: string[] = [];
    if (priorHamali > 0) earlierDuesParts.push(`Hamali ${formatCurrency(priorHamali)}`);
    if (priorInsurance > 0) earlierDuesParts.push(`Insurance ${formatCurrency(priorInsurance)}`);
    if (priorRent > 0) earlierDuesParts.push(`Old rent ${formatCurrency(priorRent)}`);
    let earlierDuesNote = earlierDuesParts.join(' + ');
    if (priorPaid > 0) earlierDuesNote += `${earlierDuesNote ? ' − ' : ''}Paid ${formatCurrency(priorPaid)}`;

    const handlePrint = () => {
        const warehouseName = warehouse?.name || 'Srilakshmi Warehouse';
        const warehouseAddress = warehouse?.location || 'Your Company Address, City, State, ZIP';
        const warehousePhone = warehouse?.phone || '(123) 456-7890';
        const warehouseEmail = warehouse?.email || 'contact@yourwarehouse.com';
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Storage Invoice - ${record.outflowInvoiceNo || record.id}</title>
                <style>
                    @media print {
                        @page { margin: 1cm; }
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                    
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                        max-width: 210mm;
                        margin: 0 auto;
                    }
                    
                    .header {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 30px;
                    }
                    
                    .header h1 {
                        margin: 0;
                        font-size: 24px;
                        color: #3b82f6;
                    }
                    
                    .header .company-info {
                        font-size: 12px;
                        color: #6b7280;
                    }
                    
                    .header .bill-info {
                        text-align: right;
                    }
                    
                    .header .bill-info h2 {
                        margin: 0;
                        font-size: 18px;
                        text-transform: uppercase;
                        color: #6b7280;
                    }
                    
                    .customer-section {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    
                    .section-title {
                        font-size: 12px;
                        font-weight: bold;
                        color: #6b7280;
                        margin-bottom: 10px;
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    
                    th {
                        background: #f3f4f6;
                        padding: 10px;
                        text-align: left;
                        font-weight: bold;
                        border: 1px solid #e5e7eb;
                    }
                    
                    td {
                        padding: 10px;
                        border: 1px solid #e5e7eb;
                    }
                    
                    .totals {
                        display: flex;
                        justify-content: flex-end;
                        margin-bottom: 30px;
                    }
                    
                    .totals-box {
                        width: 300px;
                    }
                    
                    .total-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                        font-size: 14px;
                    }
                    
                    .total-row.final {
                        font-weight: bold;
                        font-size: 16px;
                        color: #ef4444;
                        border-top: 2px solid #e5e7eb;
                        padding-top: 12px;
                        margin-top: 8px;
                    }
                    
                    .footer {
                        border-top: 1px solid #e5e7eb;
                        padding-top: 20px;
                        font-size: 11px;
                        color: #6b7280;
                        text-align: center;
                    }
                    
                    .no-print {
                        text-align: center;
                        margin: 20px 0;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>${warehouseName}</h1>
                        <div class="company-info">${warehouseAddress}</div>
                        <div class="company-info">${warehouseEmail} | ${warehousePhone}</div>
                    </div>
                    <div class="bill-info">
                        <h2>Storage Invoice</h2>
                        <div style="font-size: 12px; margin-top: 10px;">
                            <div><strong>Bill #:</strong> ${record.outflowInvoiceNo || 'Pending'}</div>
                            <div><strong>Date:</strong> ${formattedEndDate}</div>
                        </div>
                    </div>
                </div>
                
                <div class="customer-section">
                    <div>
                        <div class="section-title">BILL TO</div>
                        <div style="font-size: 16px; font-weight: 500; margin-bottom: 5px;">${customer.name}</div>
                        <div>${customer.address || ''}</div>
                        <div>Phone: ${customer.phone}</div>
                    </div>
                    <div>
                        <div class="section-title">WITHDRAWAL DETAILS</div>
                        <div><strong>Commodity:</strong> ${record.commodityDescription}</div>
                        <div><strong>Date In:</strong> ${formattedStartDate}</div>
                        <div><strong>Storage Duration:</strong> ${duration.months} months (${duration.days} days)</div>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50%;">Description</th>
                            <th>Quantity</th>
                            <th>Rate</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Storage rent</td>
                            <td>${withdrawnBags} bags</td>
                            <td>${formatCurrency(rentBreakdown.rentPerBag)} / bag</td>
                            <td style="text-align: right;">${formatCurrency(finalRent)}</td>
                        </tr>
                        ${hamaliPending > 0 ? `
                        <tr>
                            <td>Earlier dues (unpaid)${earlierDuesNote ? `<div style="font-size: 11px; color: #9ca3af;">${earlierDuesNote}</div>` : ''}</td>
                            <td>-</td>
                            <td>-</td>
                            <td style="text-align: right;">${formatCurrency(hamaliPending)}</td>
                        </tr>
                        ` : ''}
                        ${advanceAmount > 0 ? `
                        <tr>
                            <td>Advance Paid</td>
                            <td>-</td>
                            <td>-</td>
                            <td style="text-align: right; color: #059669;">- ${formatCurrency(advanceAmount)}</td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>
                
                <div class="totals">
                    <div class="totals-box">
                        <div class="total-row">
                            <span style="color: #6b7280;">Total to pay</span>
                            <span>${formatCurrency(totalPayable)}</span>
                        </div>
                        <div class="total-row">
                            <span style="color: #6b7280;">Paid now</span>
                            <span>${formatCurrency(paidNow)}</span>
                        </div>
                        <div class="total-row final">
                            <span>Still to pay</span>
                            <span>${formatCurrency(balanceDue)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="footer">
                    <h4 style="margin: 0 0 10px 0;">Notes & Terms</h4>
                    <p style="margin: 5px 0;">This bill reflects the final settlement for the withdrawal of goods.</p>
                    <p style="margin-top: 20px; font-weight: bold;">Thank you for your business!</p>
                </div>
                
                <div class="no-print">
                    <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; background: #3498db; color: white; border: none; border-radius: 4px;">
                        Print / Save as PDF
                    </button>
                    <button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; background: #95a5a6; color: white; border: none; border-radius: 4px; margin-left: 10px;">
                        Close
                    </button>
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        }
    };

    if (!record) {
        return <div className="max-w-3xl mx-auto">Loading receipt...</div>;
    }

    return (
        <div className="max-w-3xl mx-auto bg-background p-4 sm:p-6 rounded-lg">
            <div className="bg-white p-6 sm:p-8 border rounded-lg">
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-primary">{warehouse?.name || 'Srilakshmi Warehouse'}</h1>
                        <p className="text-sm text-muted-foreground">{warehouse?.location || 'Your Company Address, City, State, ZIP'}</p>
                        <p className="text-sm text-muted-foreground">{warehouse?.email || 'contact@yourwarehouse.com'} | {warehouse?.phone || '(123) 456-7890'}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-semibold uppercase text-muted-foreground">Storage Invoice</h2>
                        <p className="text-sm"><span className="font-medium">Bill #</span>: {record.outflowInvoiceNo || 'Pending'}</p>
                        <p className="text-sm"><span className="font-medium">Date:</span> {formattedEndDate}</p>
                    </div>
                </div>

                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div>
                        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">BILL TO</h3>
                        <p className="font-medium text-lg">{customer.name}</p>
                        <p>{customer.address}</p>
                        <p>Phone: {customer.phone}</p>
                    </div>
                     <div>
                        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">WITHDRAWAL DETAILS</h3>
                        <p><span className="font-medium">Commodity:</span> {record.commodityDescription}</p>
                        <p><span className="font-medium">Date In:</span> {formattedStartDate}</p>
                        <p><span className="font-medium">Storage Duration:</span> {duration.months} months ({duration.days} days)</p>
                    </div>
                </div>

                {/* QR Code for Quick Access */}
                <div className="flex justify-center mb-8 print:hidden">
                    <div className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground font-semibold">SCAN FOR QUICK ACCESS</p>
                        <div className="bg-white p-2 rounded border-2 border-primary">
                            <QRCodeSVG 
                                value={record.id}
                                size={100}
                                level="H"
                            />
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="border rounded p-4 mb-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-muted-foreground">Storage rent</div>
                            <div className="font-medium">{withdrawnBags} bags × {formatCurrency(rentBreakdown.rentPerBag)}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-medium">{formatCurrency(finalRent)}</div>
                        </div>
                        {hamaliPending > 0 && (
                            <>
                                <div>
                                    <div className="text-muted-foreground">Earlier dues (unpaid)</div>
                                    {earlierDuesNote && (
                                        <div className="text-[10px] text-muted-foreground/70">{earlierDuesNote}</div>
                                    )}
                                </div>
                                <div className="text-right"><div className="font-medium">{formatCurrency(hamaliPending)}</div></div>
                            </>
                        )}
                        {advanceAmount > 0 && (
                            <>
                                <div>
                                    <div className="text-muted-foreground text-emerald-600 dark:text-emerald-500">Advance Paid</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-medium text-emerald-600 dark:text-emerald-500">- {formatCurrency(advanceAmount)}</div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="border-t mt-4 pt-4">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Total to pay</span>
                            <span>{formatCurrency(totalPayable)}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Paid now</span>
                            <span>{formatCurrency(paidNow)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg text-destructive border-t pt-2">
                            <span>Still to pay</span>
                            <span>{formatCurrency(balanceDue)}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-xs text-muted-foreground border-t pt-4">
                    <h4 className="font-semibold mb-2">Notes & Terms</h4>
                    <p>This bill reflects the final settlement for the withdrawal of goods.</p>
                    <p className="mt-4 text-center font-semibold">Thank you for your business!</p>
                </div>
            </div>
            
            <div className="mt-6 flex justify-center">
                <Button onClick={handlePrint}>
                    <FileText className="mr-2 h-4 w-4" />
                    Print / Download PDF
                </Button>
            </div>
        </div>
    );
}
