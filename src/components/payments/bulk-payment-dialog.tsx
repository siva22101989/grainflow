'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { processBulkPayment, type BulkPaymentFormState } from '@/lib/actions/payments';
import { formatCurrency } from '@/lib/utils';
import { useUnifiedToast } from '@/components/shared/toast-provider';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SubmitButton } from '@/components/ui/submit-button';

type DueRecord = {
    id: string;
    recordNumber: string;
    totalDue: number;
    // Per-charge pending. Optional so older callers still work (they only use
    // rent/total). Missing values are treated as 0 (or totalDue for rent).
    hamaliDue?: number;
    insuranceDue?: number;
    rentDue?: number;
};

type CustomerWithDues = {
    id: string;
    name: string;
    totalDues: number;
    records: DueRecord[];
};

type BulkPaymentDialogProps = {
    customer: CustomerWithDues;
    onClose?: () => void;
    autoOpen?: boolean;
};

type Charge = 'all' | 'rent' | 'hamali' | 'insurance' | 'waiver';

const CHARGE_LABEL: Record<Charge, string> = {
    all: 'Everything (auto-split)',
    rent: 'Rent',
    hamali: 'Hamali',
    insurance: 'Insurance',
    waiver: 'Discount / Waiver',
};

function dueFor(r: DueRecord, charge: Charge): number {
    if (charge === 'waiver' || charge === 'all') return r.totalDue;
    if (charge === 'hamali') return r.hamaliDue ?? 0;
    if (charge === 'insurance') return r.insuranceDue ?? 0;
    // rent — fall back to totalDue if no breakdown was provided
    return r.rentDue ?? r.totalDue;
}

export function BulkPaymentDialog({ customer, onClose, autoOpen = false }: BulkPaymentDialogProps) {
    const { success: toastSuccess, error: toastError } = useUnifiedToast();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(autoOpen);
    const [strategy, setStrategy] = useState<'fifo' | 'manual'>('fifo');
    const [totalAmount, setTotalAmount] = useState(0);
    const [manualAllocations, setManualAllocations] = useState<Record<string, number>>({});
    const [preview, setPreview] = useState<any[]>([]);
    const lastHandledRef = useRef<any>(null);

    // Pending total for each charge across the customer's records.
    const chargeTotals = useMemo(() => ({
        all: customer.records.reduce((s, r) => s + dueFor(r, 'all'), 0),
        rent: customer.records.reduce((s, r) => s + dueFor(r, 'rent'), 0),
        hamali: customer.records.reduce((s, r) => s + dueFor(r, 'hamali'), 0),
        insurance: customer.records.reduce((s, r) => s + dueFor(r, 'insurance'), 0),
        waiver: customer.records.reduce((s, r) => s + dueFor(r, 'waiver'), 0),
    }), [customer.records]);

    // Default to "Everything" — the one-amount auto-split path most operators want.
    const [charge, setCharge] = useState<Charge>('all');
    const isWaiver = charge === 'waiver';
    const isAll = charge === 'all';

    // Records that owe the selected charge, projected onto `totalDue` so the
    // preview / manual editor / backend all allocate against that one charge.
    const chargeRecords = useMemo(
        () => customer.records
            .map(r => ({ ...r, totalDue: dueFor(r, charge) }))
            .filter(r => r.totalDue > 0),
        [customer.records, charge]
    );
    const chargeTotal = chargeTotals[charge];

    const initialState: BulkPaymentFormState = { message: '', success: false };
    const [state, formAction] = useActionState(processBulkPayment, initialState);

    // Reset amounts when switching charge so a stale value can't over-allocate.
    // "Everything" only makes sense oldest-first, so force auto there.
    useEffect(() => {
        setTotalAmount(0);
        setManualAllocations({});
        if (charge === 'all') setStrategy('fifo');
    }, [charge]);

    // FIFO preview whenever amount / charge changes
    useEffect(() => {
        let remaining = strategy === 'fifo' ? totalAmount : 0;
        setPreview(chargeRecords.map(record => {
            const allocated = strategy === 'fifo' && remaining > 0 ? Math.min(remaining, record.totalDue) : 0;
            remaining -= allocated;
            return { ...record, allocated, remaining: record.totalDue - allocated };
        }));
    }, [totalAmount, strategy, chargeRecords]);

    const handleManualChange = (recordId: string, value: number) => {
        setManualAllocations(prev => ({ ...prev, [recordId]: value }));
    };

    const manualSum = Object.values(manualAllocations).reduce((sum, val) => sum + (val || 0), 0);
    const sumMismatch = strategy === 'manual' && Math.abs(manualSum - totalAmount) > 0.01;

    useEffect(() => {
        if (state.message && state !== lastHandledRef.current) {
            lastHandledRef.current = state;
            if (state.success) {
                toastSuccess('Success', state.message);
                setIsOpen(false);
                onClose?.();
                router.refresh();
            } else {
                toastError('Error', state.message);
            }
        }
    }, [state, toastSuccess, toastError, router, onClose]);

    const handleSubmit = (formData: FormData) => {
        formData.append('customerId', customer.id);
        formData.append('totalAmount', totalAmount.toString());
        formData.append('strategy', strategy);
        formData.append('paymentType', charge);

        if (strategy === 'manual') {
            const allocationsArray = chargeRecords.map(record => ({
                recordId: record.id,
                amount: manualAllocations[record.id] || 0,
            }));
            formData.append('manualAllocations', JSON.stringify(allocationsArray));
        }

        formAction(formData);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) onClose?.();
        }}>
            {!autoOpen && (
                <DialogTrigger asChild>
                    <Button size="sm" variant="default">
                        Collect Payment
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <form action={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isWaiver ? 'Apply Discount / Waiver' : isAll ? 'Collect Payment' : `Collect ${CHARGE_LABEL[charge]}`}</DialogTitle>
                        <DialogDescription>
                            {isWaiver
                                ? <>Waive part of the outstanding balance for <strong>{customer.name}</strong>. Reduces what's owed but is not counted as cash received.</>
                                : isAll
                                ? <>Record one payment for <strong>{customer.name}</strong>. It auto-fills <strong>hamali → insurance → rent</strong>, oldest bills first.</>
                                : <>Record a <strong>{CHARGE_LABEL[charge].toLowerCase()}</strong> payment for <strong>{customer.name}</strong>. It only reduces pending {CHARGE_LABEL[charge].toLowerCase()}.</>}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Pending for the selected charge */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span className="text-sm font-medium">
                                Pending {isWaiver || isAll ? 'Total' : CHARGE_LABEL[charge]}:
                            </span>
                            <Badge variant="destructive" className="text-base">
                                {formatCurrency(chargeTotal)}
                            </Badge>
                        </div>

                        {/* Paying towards which charge */}
                        <div className="grid gap-2">
                            <Label>Paying towards</Label>
                            <RadioGroup
                                value={charge}
                                onValueChange={(value: Charge) => setCharge(value)}
                                className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-4"
                            >
                                {(['all', 'rent', 'hamali', 'insurance', 'waiver'] as Charge[]).map(c => (
                                    <div key={c} className="flex items-center space-x-2">
                                        <RadioGroupItem value={c} id={`charge-${c}`} />
                                        <Label htmlFor={`charge-${c}`} className="font-normal cursor-pointer">
                                            {CHARGE_LABEL[c]}
                                            {c !== 'waiver' && chargeTotals[c] > 0 && (
                                                <span className="text-xs text-muted-foreground ml-1">({formatCurrency(chargeTotals[c])})</span>
                                            )}
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>

                        {/* Amount */}
                        <div className="grid gap-2">
                            <Label htmlFor="totalAmount">{isWaiver ? 'Discount Amount' : 'Amount Received'}</Label>
                            <Input
                                id="totalAmount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={chargeTotal}
                                placeholder={`Max: ${formatCurrency(chargeTotal)}`}
                                value={totalAmount || ''}
                                onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                                onFocus={(e) => e.target.select()}
                                onWheel={(e) => e.currentTarget.blur()}
                                required
                            />
                            {totalAmount > chargeTotal && (
                                <p className="text-xs text-destructive">
                                    Amount exceeds pending {isWaiver ? 'balance' : CHARGE_LABEL[charge].toLowerCase()} of {formatCurrency(chargeTotal)}
                                </p>
                            )}
                        </div>

                        {/* Payment Date */}
                        <div className="grid gap-2">
                            <Label htmlFor="paymentDate">Payment Date</Label>
                            <Input
                                id="paymentDate"
                                name="paymentDate"
                                type="date"
                                defaultValue={new Date().toISOString().split('T')[0]}
                                required
                            />
                        </div>

                        {/* Allocation Strategy — "Everything" is always oldest-first */}
                        {!isAll && (
                        <div className="grid gap-2">
                            <Label>Allocation Strategy</Label>
                            <RadioGroup
                                value={strategy}
                                onValueChange={(value: 'fifo' | 'manual') => setStrategy(value)}
                                className="flex gap-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="fifo" id="fifo" />
                                    <Label htmlFor="fifo" className="font-normal cursor-pointer">
                                        Auto (Oldest bill first)
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="manual" id="manual" />
                                    <Label htmlFor="manual" className="font-normal cursor-pointer">
                                        Manual Distribution
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                        )}

                        {sumMismatch && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Allocation sum ({formatCurrency(manualSum)}) does not match amount ({formatCurrency(totalAmount)})
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Allocation Preview/Editor */}
                        <div className="border rounded-lg overflow-hidden">
                            <div className="bg-muted px-4 py-2">
                                <p className="text-sm font-medium">
                                    {strategy === 'fifo' ? 'Allocation Preview' : 'Manual Allocation'} — {isWaiver ? 'Balance' : isAll ? 'Total' : CHARGE_LABEL[charge]}
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Record</TableHead>
                                            <TableHead className="text-right">Pending</TableHead>
                                            <TableHead className="text-right">Allocated</TableHead>
                                            <TableHead className="text-right">Remaining</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {chargeRecords.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                                                    No pending {isWaiver || isAll ? 'dues' : CHARGE_LABEL[charge].toLowerCase()} for this customer.
                                                </TableCell>
                                            </TableRow>
                                        ) : strategy === 'fifo' ? (
                                            preview.map((record) => (
                                                <TableRow key={record.id}>
                                                    <TableCell className="font-medium">#{record.recordNumber}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(record.totalDue)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {formatCurrency(record.allocated)}
                                                            {record.allocated > 0 && record.remaining === 0 && (
                                                                <Check className="h-4 w-4 text-green-600" />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">{formatCurrency(record.remaining)}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            chargeRecords.map((record) => {
                                                const allocated = manualAllocations[record.id] || 0;
                                                const remaining = record.totalDue - allocated;
                                                return (
                                                    <TableRow key={record.id}>
                                                        <TableCell className="font-medium">#{record.recordNumber}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(record.totalDue)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max={record.totalDue}
                                                                value={allocated || ''}
                                                                onChange={(e) => handleManualChange(record.id, parseFloat(e.target.value) || 0)}
                                                                className="w-28 text-right"
                                                                onFocus={(e) => e.target.select()}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right text-muted-foreground">{formatCurrency(remaining)}</TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <SubmitButton disabled={sumMismatch || totalAmount <= 0 || totalAmount > chargeTotal}>
                            {isWaiver ? 'Apply Discount' : isAll ? 'Collect Payment' : `Collect ${CHARGE_LABEL[charge]}`}
                        </SubmitButton>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
