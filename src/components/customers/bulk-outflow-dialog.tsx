'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, PackageMinus, Calculator } from "lucide-react";
import { formatCurrency } from '@/lib/utils';
import { processBulkOutflow, type BulkOutflowResult } from '@/lib/actions/storage/bulk-outflow';
import { useUnifiedToast } from '@/components/shared/toast-provider';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { calculateFinalRent } from '@/lib/billing';
import { usePreventNavigation } from '@/hooks/use-prevent-navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BulkOutflowDialogProps {
    customer: Customer;
    records: StorageRecord[];
    crops?: any[];
    onOpenChange?: (open: boolean) => void;
}

const initialState: BulkOutflowResult = {
    message: '',
    success: false
};

export function BulkOutflowDialog({ customer, records, crops, onOpenChange: _onOpenChange }: BulkOutflowDialogProps) {
    const [open, setOpen] = useState(false);
    // Removed step state
    const { success: showSuccess } = useUnifiedToast();
    const router = useRouter();

    const [state, formAction, isPending] = useActionState(processBulkOutflow, initialState);

    // Prevent navigation while pending
    usePreventNavigation(isPending);

    // Form Stats
    const [commodity, setCommodity] = useState<string>('');
    const [bagsToWithdraw, setBagsToWithdraw] = useState<string>('');
    const [rentPaidNow, setRentPaidNow] = useState<string>('');
    const [discount, setDiscount] = useState<string>('');
    const [withdrawalDate, setWithdrawalDate] = useState<string>(new Date().toISOString().split('T')[0] || '');
    const [sendSms, setSendSms] = useState(true);

    const [excludedRecordIds, setExcludedRecordIds] = useState<Set<string>>(new Set());
    const [manualOverrides, setManualOverrides] = useState<Record<string, number>>({});

    useMemo(() => {
        setExcludedRecordIds(new Set());
        setManualOverrides({});
    }, [commodity]);

    // Helper: get crop pricing for a record
    const getCropPricing = (record: StorageRecord) => {
        if (record.cropId && crops) {
            const crop = crops.find((c: any) => c.id === record.cropId);
            if (crop) {
                return { price6m: crop.rent_price_6m, price1y: crop.rent_price_1y };
            }
        }
        return undefined;
    };

    // Helper: get pricing slabs for a record
    const getCropPricingSlabs = (record: StorageRecord) => {
        if (record.cropId && crops) {
            const crop = crops.find((c: any) => c.id === record.cropId);
            if (crop?.pricing_slabs) return crop.pricing_slabs;
        }
        return undefined;
    };

    // Derived: Available Commodities
    const commodities = useMemo(() => {
        const unique = new Set(records.filter(r => !r.storageEndDate && r.bagsStored > 0).map(r => r.commodityDescription));
        return Array.from(unique);
    }, [records]);

    // Derived: Max Bags for Selected Commodity
    const maxBags = useMemo(() => {
        if (!commodity) return 0;
        return records
            .filter(r => r.commodityDescription === commodity && !r.storageEndDate)
            .reduce((sum, r) => sum + r.bagsStored, 0);
    }, [records, commodity]);

    // Derived: Preview Logic
    const previewPlan = useMemo(() => {
        if (!commodity || !bagsToWithdraw) return null;
        
        const targetBags = parseInt(bagsToWithdraw);
        if (isNaN(targetBags) || targetBags <= 0) return null;

        const activeRecords = records
            .filter(r => 
                r.commodityDescription === commodity && 
                !r.storageEndDate && 
                r.bagsStored > 0 &&
                !excludedRecordIds.has(r.id)
            )
            .sort((a, b) => new Date(a.storageStartDate).getTime() - new Date(b.storageStartDate).getTime());

        const hasOverrides = Object.keys(manualOverrides).length > 0;
        let remaining = targetBags;
        const plan = [];
        let totalHamaliPending = 0;
        let totalAdvanceAmount = 0;
        // Breakdown of the prior charges behind "Previous Balance" (only records
        // that actually owe), so insurance is visible. These reconcile:
        // priorHamali + priorInsurance + priorRent - priorPaid === totalHamaliPending
        let totalPriorHamali = 0;
        let totalPriorInsurance = 0;
        let totalPriorRent = 0;
        let totalPriorPaid = 0;

        for (const r of activeRecords) {
            let take: number;
            if (hasOverrides && manualOverrides[r.id] !== undefined) {
                take = Math.min(manualOverrides[r.id]!, r.bagsStored);
            } else if (hasOverrides) {
                // Record not in overrides, skip (user hasn't allocated to it)
                take = 0;
            } else {
                // Default FIFO
                if (remaining <= 0) { take = 0; } else {
                    take = Math.min(r.bagsStored, remaining);
                    remaining -= take;
                }
            }

            if (take <= 0) continue;

            const { rent } = calculateFinalRent(r, new Date(withdrawalDate), take, getCropPricing(r), getCropPricingSlabs(r));

            const amountPaid = (r.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const totalBilledSoFar = r.hamaliPayable + (r.insurancePayable || 0) + (r.totalRentBilled || 0);
            const pending = totalBilledSoFar - amountPaid;

            if (pending > 0) {
                totalHamaliPending += pending;
                totalPriorHamali += r.hamaliPayable;
                totalPriorInsurance += (r.insurancePayable || 0);
                totalPriorRent += (r.totalRentBilled || 0);
                totalPriorPaid += amountPaid;
            } else {
                totalAdvanceAmount += Math.abs(pending);
            }

            plan.push({
                record: r,
                take,
                rent,
                isClosing: take === r.bagsStored
            });
        }

        const totalAllocated = plan.reduce((sum, p) => sum + p.take, 0);

        return {
            operations: plan,
            totalRent: plan.reduce((sum, p) => sum + p.rent, 0),
            totalHamaliPending,
            totalAdvanceAmount,
            totalPriorHamali,
            totalPriorInsurance,
            totalPriorRent,
            totalPriorPaid,
            impossible: hasOverrides ? totalAllocated > targetBags : remaining > 0,
            activeRecordCount: activeRecords.length,
            totalAllocated
        };
    }, [records, commodity, bagsToWithdraw, withdrawalDate, excludedRecordIds, manualOverrides, crops]);

    const toggleRecordSelection = (recordId: string, checked: boolean) => {
        const newSet = new Set(excludedRecordIds);
        if (checked) {
            newSet.delete(recordId);
        } else {
            newSet.add(recordId);
        }
        setExcludedRecordIds(newSet);
    };

    const specificRecordIdsValue = useMemo(() => {
        if (!previewPlan) return '';
        return previewPlan.operations.map(op => op.record.id).join(',');
    }, [previewPlan]);

    const recordAllocationsValue = useMemo(() => {
        if (!previewPlan || Object.keys(manualOverrides).length === 0) return '';
        return JSON.stringify(previewPlan.operations.map(op => ({
            recordId: op.record.id,
            bags: op.take
        })));
    }, [previewPlan, manualOverrides]);

    const handleBagOverride = (recordId: string, value: string, maxBags: number) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 0) {
            const newOverrides = { ...manualOverrides };
            delete newOverrides[recordId];
            setManualOverrides(newOverrides);
            return;
        }
        // Clamp to record's available bags
        let clamped = Math.min(num, maxBags);

        // Clamp to total bag limit: sum of all OTHER overrides + this one must not exceed target
        const targetBags = parseInt(bagsToWithdraw) || 0;
        if (targetBags > 0) {
            const othersTotal = Object.entries(manualOverrides)
                .filter(([id]) => id !== recordId)
                .reduce((sum, [, bags]) => sum + bags, 0);
            const maxForThisRecord = Math.max(0, targetBags - othersTotal);
            clamped = Math.min(clamped, maxForThisRecord);
        }

        setManualOverrides(prev => ({ ...prev, [recordId]: clamped }));
    };


    useEffect(() => {
        if (state?.success && open) {
            setOpen(false);
            showSuccess('Bulk Outflow Complete', state.message);
            router.refresh();
            // If the server returned a consolidated invoice number, open the
            // printable consolidated bill in a new tab so the user can show
            // or hand it to the customer immediately.
            if (state.consolidatedInvoiceNo) {
                window.open(`/outflow/batch/${encodeURIComponent(state.consolidatedInvoiceNo)}`, '_blank', 'noopener,noreferrer');
            }
            setBagsToWithdraw('');
            setRentPaidNow('');
            setDiscount('');
            setExcludedRecordIds(new Set());
        }
    }, [state, open, showSuccess, router]);

    const reset = () => {
        setBagsToWithdraw('');
        setRentPaidNow('');
        setDiscount('');
        setCommodity('');
        setExcludedRecordIds(new Set());
        setManualOverrides({});
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { 
            // Prevent closing if processing
            if (isPending && !v) return;
            setOpen(v); 
            if(!v) reset(); 
        }}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <PackageMinus className="h-4 w-4 mr-2" />
                    Bulk Outflow
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => {
                if (isPending) e.preventDefault();
            }}>
                <form action={formAction}>
                    <fieldset disabled={isPending} className="group">
                        <DialogHeader>
                            <DialogTitle>Bulk Outflow</DialogTitle>
                            <DialogDescription>
                                Withdraw bags from multiple records automatically (FIFO).
                            </DialogDescription>
                        </DialogHeader>

                        {/* Hidden Inputs */}
                        <input type="hidden" name="customerId" value={customer.id} />
                        <input type="hidden" name="commodity" value={commodity} />
                        <input type="hidden" name="withdrawalDate" value={withdrawalDate} />
                        <input type="hidden" name="finalRent" value={previewPlan?.totalRent || 0} />
                        <input type="hidden" name="discount" value={discount} />
                        <input type="hidden" name="amountPaidNow" value={rentPaidNow} />
                        <input type="hidden" name="sendSms" value={String(sendSms)} />
                        <input type="hidden" name="specificRecordIds" value={specificRecordIdsValue} />
                        <input type="hidden" name="recordAllocations" value={recordAllocationsValue} />
                        <input type="hidden" name="totalBagsToWithdraw" value={previewPlan?.totalAllocated || bagsToWithdraw} />

                        <div className={`grid gap-4 py-4 transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                            {/* Inputs Section */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Commodity</Label>
                                    <Select value={commodity} onValueChange={setCommodity} disabled={isPending}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select commodity" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {commodities.map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Withdrawal Date</Label>
                                    <Input 
                                        type="date" 
                                        value={withdrawalDate} 
                                        onChange={(e) => setWithdrawalDate(e.target.value)}
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                            </div>



                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Bags to Withdraw</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            type="number" 
                                            placeholder={commodity ? `Available: ${maxBags}` : "Enter quantity"}
                                            value={bagsToWithdraw} 
                                            onChange={(e) => setBagsToWithdraw(e.target.value)}
                                            min="1"
                                        />
                                        <Button 
                                            type="button" 
                                            variant="secondary" 
                                            onClick={() => setBagsToWithdraw(String(maxBags))}
                                            disabled={!maxBags || isPending}
                                        >
                                            Max
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="sms" 
                                    checked={sendSms} 
                                    onCheckedChange={(c) => setSendSms(!!c)} 
                                    disabled={isPending}
                                />
                                <Label htmlFor="sms" className="text-sm font-normal text-muted-foreground">
                                    Send confirmation SMS to customer
                                </Label>
                            </div>

                            {/* Preview Section - Shows automatically when inputs valid */}
                            <div className={`transition-all duration-300 ease-in-out ${previewPlan ? 'opacity-100 max-h-[1000px]' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                            {previewPlan && (
                                <div className="space-y-4 pt-4 border-t">
                                    <Alert className={previewPlan.impossible ? "border-destructive text-destructive" : "bg-primary/5 border-primary/20"}>
                                        <Calculator className="h-4 w-4" />
                                        <AlertTitle>Summary</AlertTitle>
                                         <AlertDescription className="flex flex-col gap-1 mt-1">
                                            <div className="flex justify-between font-medium">
                                                <span>Total Bags: {previewPlan.totalAllocated ?? bagsToWithdraw}</span>
                                                <span className="text-muted-foreground">Rent: {formatCurrency(previewPlan.totalRent || 0)}</span>
                                            </div>
                                            {(previewPlan.totalHamaliPending > 0) && (
                                                <div className="border-t border-border/50 pt-1 mt-1 space-y-0.5">
                                                    <div className="text-xs font-medium">Old Balance</div>
                                                    <div className="flex justify-between text-xs pl-3">
                                                        <span>Old Hamali</span>
                                                        <span>{formatCurrency(previewPlan.totalPriorHamali)}</span>
                                                    </div>
                                                    {previewPlan.totalPriorInsurance > 0 && (
                                                        <div className="flex justify-between text-xs pl-3">
                                                            <span>Old Insurance</span>
                                                            <span>{formatCurrency(previewPlan.totalPriorInsurance)}</span>
                                                        </div>
                                                    )}
                                                    {previewPlan.totalPriorRent > 0 && (
                                                        <div className="flex justify-between text-xs pl-3">
                                                            <span>Old Rent</span>
                                                            <span>{formatCurrency(previewPlan.totalPriorRent)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-xs pl-3">
                                                        <span>Already Paid</span>
                                                        <span>- {formatCurrency(previewPlan.totalPriorPaid)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm font-medium pl-3">
                                                        <span>Balance</span>
                                                        <span>{formatCurrency(previewPlan.totalHamaliPending)}</span>
                                                    </div>
                                                </div>
                                            )}
                                            {(previewPlan.totalAdvanceAmount > 0) && (
                                                <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-500 font-medium">
                                                    <span>Advance Paid:</span>
                                                    <span>- {formatCurrency(previewPlan.totalAdvanceAmount)}</span>
                                                </div>
                                            )}
                                            {discount && (
                                                <div className="flex justify-between text-sm">
                                                    <span>Discount:</span>
                                                    <span>- {formatCurrency(parseFloat(discount || '0') || 0)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-border/50">
                                                <span>To Pay Now:</span>
                                                <span>{formatCurrency(Math.max(0, (previewPlan.totalRent || 0) + previewPlan.totalHamaliPending - previewPlan.totalAdvanceAmount - (parseFloat(discount || '0') || 0)))}</span>
                                            </div>
                                            {previewPlan.impossible && (
                                                <span className="font-bold text-destructive mt-1">
                                                    {Object.keys(manualOverrides).length > 0
                                                        ? `Warning: Manual allocation total (${previewPlan.totalAllocated}) exceeds requested bags (${bagsToWithdraw}).`
                                                        : `Warning: You requested ${bagsToWithdraw} bags but only ${maxBags - Array.from(excludedRecordIds).reduce((sum, id) => sum + (records.find(r => r.id === id)?.bagsStored || 0), 0)} are selected!`
                                                    }
                                                </span>
                                            )}
                                        </AlertDescription>
                                    </Alert>

                                    <div className="border rounded-md max-h-[400px] overflow-y-auto">
                                        {/* Mobile View: Cards */}
                                        <div className="md:hidden space-y-2 p-2">
                                            {records
                                                .filter(r => r.commodityDescription === commodity && !r.storageEndDate && r.bagsStored > 0)
                                                .sort((a, b) => new Date(a.storageStartDate).getTime() - new Date(b.storageStartDate).getTime())
                                                .map((r) => {
                                                    const inPlan = previewPlan.operations.find(op => op.record.id === r.id);
                                                    const isExcluded = excludedRecordIds.has(r.id);
                                                    
                                                    return (
                                                        <Card key={r.id} className={`overflow-hidden transition-all ${inPlan?.isClosing ? "border-destructive/50 bg-destructive/5" : (isExcluded ? "opacity-60 bg-muted/50" : "bg-card")}`}>
                                                            <CardContent className="p-3">
                                                                <div className="flex items-start gap-3">
                                                                    <Checkbox 
                                                                        checked={!isExcluded}
                                                                        onCheckedChange={(c) => toggleRecordSelection(r.id, !!c)}
                                                                        disabled={isPending}
                                                                        className="mt-1"
                                                                    />
                                                                    <div className="flex-1 space-y-2">
                                                                        {/* Header */}
                                                                        <div className="flex justify-between items-start">
                                                                            <div>
                                                                                <div className="font-medium pr-2">
                                                                                    Record #{r.recordNumber}
                                                                                </div>
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    {new Date(r.storageStartDate).toLocaleDateString()}
                                                                                    {r.location && ` • ${r.location}`}
                                                                                </div>
                                                                            </div>
                                                                            <Badge variant="outline" className="shrink-0">
                                                                                {r.bagsStored} Bags
                                                                            </Badge>
                                                                        </div>

                                                                        {!isExcluded && (
                                                                            <div className="flex items-center justify-between text-sm bg-background/50 p-2 rounded border border-border/50">
                                                                                <div className="font-semibold text-destructive flex items-center gap-2">
                                                                                    <PackageMinus className="h-3 w-3" />
                                                                                    <Input
                                                                                        type="number"
                                                                                        min={0}
                                                                                        max={r.bagsStored}
                                                                                        value={manualOverrides[r.id] !== undefined ? manualOverrides[r.id] : (inPlan?.take ?? 0)}
                                                                                        onChange={(e) => handleBagOverride(r.id, e.target.value, r.bagsStored)}
                                                                                        className="w-16 h-7 text-xs text-right font-bold text-destructive p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                        disabled={isPending}
                                                                                    />
                                                                                    {(manualOverrides[r.id] !== undefined ? manualOverrides[r.id] : (inPlan?.take ?? 0)) === r.bagsStored && (
                                                                                        <Badge variant="destructive" className="h-4 px-1 text-[10px]">CLOSE</Badge>
                                                                                    )}
                                                                                </div>
                                                                                <div className="font-medium text-muted-foreground">
                                                                                    Rent: {inPlan ? formatCurrency(inPlan.rent) : '-'}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    )
                                                })}
                                        </div>

                                        {/* Desktop View: Table */}
                                        <div className="hidden md:block overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[40px]">Use</TableHead>
                                                    <TableHead>Lot</TableHead>
                                                    <TableHead>Record #</TableHead>
                                                    <TableHead>Date In</TableHead>
                                                    <TableHead className="text-right">Stock</TableHead>
                                                    <TableHead className="text-right text-destructive font-bold">Withdraw</TableHead>
                                                    <TableHead className="text-right">Rent</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {records
                                                    .filter(r => r.commodityDescription === commodity && !r.storageEndDate && r.bagsStored > 0)
                                                    .sort((a, b) => new Date(a.storageStartDate).getTime() - new Date(b.storageStartDate).getTime())
                                                    .map((r) => {
                                                        const inPlan = previewPlan.operations.find(op => op.record.id === r.id);
                                                        const isExcluded = excludedRecordIds.has(r.id);
                                                        
                                                        return (
                                                            <TableRow key={r.id} className={inPlan?.isClosing ? "bg-red-50/50" : (isExcluded ? "opacity-50" : "")}>
                                                                <TableCell>
                                                                    <Checkbox 
                                                                        checked={!isExcluded}
                                                                        onCheckedChange={(c) => toggleRecordSelection(r.id, !!c)}
                                                                        disabled={isPending}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-xs font-medium">{r.location || '-'}</TableCell>
                                                                <TableCell className="font-mono text-xs">#{r.recordNumber}</TableCell>
                                                                <TableCell className="text-xs">{new Date(r.storageStartDate).toLocaleDateString()}</TableCell>
                                                                <TableCell className="text-right text-xs text-muted-foreground">{r.bagsStored}</TableCell>
                                                                <TableCell className="text-right">
                                                                    {!isExcluded ? (
                                                                        <div className="flex items-center justify-end gap-1">
                                                                            <span className="text-destructive font-bold">-</span>
                                                                            <Input
                                                                                type="number"
                                                                                min={0}
                                                                                max={r.bagsStored}
                                                                                value={manualOverrides[r.id] !== undefined ? manualOverrides[r.id] : (inPlan?.take ?? 0)}
                                                                                onChange={(e) => handleBagOverride(r.id, e.target.value, r.bagsStored)}
                                                                                className="w-16 h-7 text-xs text-right font-bold text-destructive p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                disabled={isPending}
                                                                            />
                                                                            {(manualOverrides[r.id] !== undefined ? manualOverrides[r.id] : (inPlan?.take ?? 0)) === r.bagsStored && (
                                                                                <span className="text-[10px] uppercase bg-destructive text-white px-1 rounded">Close</span>
                                                                            )}
                                                                        </div>
                                                                    ) : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right text-xs">
                                                                    {inPlan ? formatCurrency(inPlan.rent) : '-'}
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                            </TableBody>
                                        </Table>
                                        </div>
                                    </div>

                                    <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2 border-t border-border/50">
                                        <div>
                                            <Label className="mb-2 block">Discount (Optional)</Label>
                                            <div className="flex gap-4 items-center">
                                                <Input 
                                                    type="number" 
                                                    placeholder="Enter discount amount" 
                                                    value={discount} 
                                                    onChange={(e) => setDiscount(e.target.value)}
                                                    className="w-full"
                                                />
                                            </div>
                                            {discount && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    Distributed across records.
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <Label className="mb-2 block">Rent Payment (Optional)</Label>
                                            <div className="flex gap-4 items-center">
                                                <Input 
                                                    type="number" 
                                                    placeholder="Amount to pay now" 
                                                    value={rentPaidNow} 
                                                    onChange={(e) => setRentPaidNow(e.target.value)}
                                                    className="w-full"
                                                />
                                            </div>
                                            {rentPaidNow && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    Will be distributed proportionally.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            </div>
                        </div>

                        {!state?.success && state?.message && (
                            <Alert variant="destructive" className="mt-2">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{state.message}</AlertDescription>
                            </Alert>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending || !previewPlan || previewPlan.impossible}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    'Confirm & Process'
                                )}
                            </Button>
                        </DialogFooter>
                    </fieldset>
                </form>
            </DialogContent>
        </Dialog>
    );
}
