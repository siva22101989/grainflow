'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Receipt, Wheat, Download } from "lucide-react";
import { format } from "date-fns";
import { generateStatementPDF } from "@/lib/pdf-generator";

interface RecordDetailDialogProps {
    record: any;
    trigger?: React.ReactNode;
}

export function RecordDetailDialog({ record, trigger }: RecordDetailDialogProps) {
    const payments = record.payments || [];
    const withdrawals = record.withdrawal_transactions || [];
    
    // Combine and sort events
    const events = [
        {
            type: 'DEPOSIT',
            id: 'initial',
            date: new Date(record.storage_start_date),
            amount: record.bags_in || record.bags_stored, // bags
            title: 'Initial Inflow'
        },
        ...payments.map((p: any) => ({
            type: 'PAYMENT',
            id: p.id,
            date: new Date(p.payment_date || p.created_at),
            amount: p.amount, // currency
            title: 'Payment Received'
        })),
        ...withdrawals.map((w: any) => ({
            type: 'WITHDRAWAL',
            id: w.id,
            date: new Date(w.withdrawal_date || w.created_at),
            amount: w.bags_withdrawn, // bags
            title: 'Stock Withdrawal'
        }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime()); // Newest first

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger || (
                    <button className="text-primary hover:underline text-xs font-medium">
                        View Details
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-3xl">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-2xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                            <Wheat className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                        </div>
                        <div className="space-y-0.5">
                            <DialogTitle className="text-lg font-bold">{record.crops?.name || 'Crop'}</DialogTitle>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium bg-muted px-1.5 py-0.5 rounded-md text-foreground">
                                    Lot: {record.lot_name}
                                </span>
                                <span className="text-muted-foreground/30">|</span>
                                <span>Record #{record.record_number || record.id.slice(0, 8)}</span>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-muted/50 p-4 rounded-2xl border border-border/50">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Current Stock</p>
                        <p className="text-2xl font-black text-foreground">{record.bags_stored} <span className="text-xs font-normal text-muted-foreground">Bags</span></p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-2xl border border-border/50">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Balance Due</p>
                        <p className="text-2xl font-black text-red-600 dark:text-red-500">₹{record.billed - record.paid}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2 px-1">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        Transaction History
                    </h3>
                    
                    <ScrollArea className="h-[250px] pr-4">
                        <div className="space-y-3">
                            {events.map((event) => {
                                if (event.type === 'DEPOSIT') {
                                    return (
                                        <div key={event.id} className="flex items-start gap-3 p-3 rounded-2xl bg-green-500/10 border border-green-500/20">
                                            <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <p className="text-sm font-bold text-foreground">{event.title}</p>
                                                    <p className="text-sm font-black text-green-700 dark:text-green-500">+{event.amount}</p>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">{format(event.date, 'dd MMM yyyy')}</p>
                                            </div>
                                        </div>
                                    );
                                }
                                if (event.type === 'WITHDRAWAL') {
                                    return (
                                        <div key={event.id} className="flex items-start gap-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                                            <div className="mt-1 h-2 w-2 rounded-full bg-red-500" />
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <p className="text-sm font-bold text-foreground">{event.title}</p>
                                                    <p className="text-sm font-black text-red-700 dark:text-red-500">-{event.amount} Bags</p>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">{format(event.date, 'dd MMM yyyy')}</p>
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={event.id} className="flex items-start gap-3 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                                        <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-bold text-foreground">{event.title}</p>
                                                <p className="text-sm font-black text-blue-700 dark:text-blue-500">₹{event.amount}</p>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">{format(event.date, 'dd MMM yyyy')}</p>
                                        </div>
                                    </div>
                                );
                            })}

                            {events.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-xs text-muted-foreground italic">No activity recorded.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                
                <div className="mt-4 pt-4 border-t border-border">
                    <button 
                        onClick={() => generateStatementPDF(record, events)}
                        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform hover:bg-primary/90"
                    >
                        <Download className="h-4 w-4" />
                        Download PDF Statement
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
