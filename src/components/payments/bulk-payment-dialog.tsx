'use client';

import { useState, useEffect, useRef } from 'react';
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

type CustomerWithDues = {
    id: string;
    name: string;
    totalDues: number;
    records: {
        id: string;
        recordNumber: string;
        totalDue: number;
    }[];
};

type BulkPaymentDialogProps = {
    customer: CustomerWithDues;
    onClose?: () => void;
    autoOpen?: boolean;
};

export function BulkPaymentDialog({ customer, onClose, autoOpen = false }: BulkPaymentDialogProps) {
    const { success: toastSuccess, error: toastError } = useUnifiedToast();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(autoOpen);
    const [mode, setMode] = useState<'cash' | 'waiver'>('cash');
    const [strategy, setStrategy] = useState<'fifo' | 'manual'>('fifo');
    const isWaiver = mode === 'waiver';
    const [totalAmount, setTotalAmount] = useState(0);
    const [manualAllocations, setManualAllocations] = useState<Record<string, number>>({});
    const [preview, setPreview] = useState<any[]>([]);
    const lastHandledRef = useRef<any>(null);

    const initialState: BulkPaymentFormState = { message: '', success: false };
    const [state, formAction] = useActionState(processBulkPayment, initialState);

    // Calculate FIFO preview whenever amount changes
    useEffect(() => {
        if (strategy === 'fifo' && totalAmount > 0) {
            let remaining = totalAmount;
            const newPreview = customer.records.map(record => {
                if (remaining <= 0) {
                    return {
                        ...record,
                        allocated: 0,
                        remaining: record.totalDue
                    };
                }
                const allocated = Math.min(remaining, record.totalDue);
                remaining -= allocated;
                return {
                    ...record,
                    allocated,
                    remaining: record.totalDue - allocated
                };
            });
            setPreview(newPreview);
        } else if (strategy === 'fifo') {
            // Show zero allocation when no amount entered
            setPreview(customer.records.map(record => ({
                ...record,
                allocated: 0,
                remaining: record.totalDue
            })));
        }
    }, [totalAmount, strategy, customer.records]);

    // Handle manual allocation changes
    const handleManualChange = (recordId: string, value: number) => {
        setManualAllocations(prev => ({
            ...prev,
            [recordId]: value
        }));
    };

    // Calculate manual allocation sum
    const manualSum = Object.values(manualAllocations).reduce((sum, val) => sum + (val || 0), 0);
    const sumMismatch = strategy === 'manual' && Math.abs(manualSum - totalAmount) > 0.01;

    // Handle success/error
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
        // Add hidden fields
        formData.append('customerId', customer.id);
        formData.append('totalAmount', totalAmount.toString());
        formData.append('strategy', strategy);
        formData.append('paymentType', isWaiver ? 'waiver' : 'rent');
        
        if (strategy === 'manual') {
            const allocationsArray = customer.records.map(record => ({
                recordId: record.id,
                amount: manualAllocations[record.id] || 0
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
                        Bulk Payment
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <form action={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isWaiver ? 'Apply Bulk Discount / Waiver' : 'Record Bulk Payment'}</DialogTitle>
                        <DialogDescription>
                            {isWaiver
                                ? <>Waive part of the outstanding balance across multiple records for <strong>{customer.name}</strong>. This reduces what's owed but is not counted as cash received.</>
                                : <>Process payment across multiple records for <strong>{customer.name}</strong></>}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Total Dues Badge */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span className="text-sm font-medium">Total Outstanding Dues:</span>
                            <Badge variant="destructive" className="text-base">
                                {formatCurrency(customer.totalDues)}
                            </Badge>
                        </div>

                        {/* Mode: Cash Payment vs Discount/Waiver */}
                        <div className="grid gap-2">
                            <Label>Transaction Type</Label>
                            <RadioGroup
                                value={mode}
                                onValueChange={(value: 'cash' | 'waiver') => setMode(value)}
                                className="flex gap-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="cash" id="mode-cash" />
                                    <Label htmlFor="mode-cash" className="font-normal cursor-pointer">
                                        Cash Payment
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="waiver" id="mode-waiver" />
                                    <Label htmlFor="mode-waiver" className="font-normal cursor-pointer">
                                        Discount / Waiver
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {/* Payment Amount */}
                        <div className="grid gap-2">
                            <Label htmlFor="totalAmount">{isWaiver ? 'Discount Amount' : 'Payment Amount'}</Label>
                            <Input
                                id="totalAmount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={customer.totalDues}
                                placeholder={`Max: ${formatCurrency(customer.totalDues)}`}
                                value={totalAmount || ''}
                                onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                                onFocus={(e) => e.target.select()}
                                onWheel={(e) => e.currentTarget.blur()}
                                required
                            />
                            {totalAmount > customer.totalDues && (
                                <p className="text-xs text-destructive">
                                    Amount exceeds total dues
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

                        {/* Allocation Strategy */}
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
                                        Auto (FIFO - Oldest First)
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

                        {/* Manual Sum Mismatch Warning */}
                        {sumMismatch && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Allocation sum ({formatCurrency(manualSum)}) does not match payment amount ({formatCurrency(totalAmount)})
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Allocation Preview/Editor */}
                        <div className="border rounded-lg overflow-hidden">
                            <div className="bg-muted px-4 py-2">
                                <p className="text-sm font-medium">
                                    {strategy === 'fifo' ? 'Allocation Preview' : 'Manual Allocation'}
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Record</TableHead>
                                            <TableHead className="text-right">Current Due</TableHead>
                                            <TableHead className="text-right">Allocated</TableHead>
                                            <TableHead className="text-right">Remaining</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {strategy === 'fifo' ? (
                                            preview.map((record) => (
                                                <TableRow key={record.id}>
                                                    <TableCell className="font-medium">
                                                        #{record.recordNumber}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatCurrency(record.totalDue)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {formatCurrency(record.allocated)}
                                                            {record.allocated > 0 && record.remaining === 0 && (
                                                                <Check className="h-4 w-4 text-green-600" />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        {formatCurrency(record.remaining)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            customer.records.map((record) => {
                                                const allocated = manualAllocations[record.id] || 0;
                                                const remaining = record.totalDue - allocated;
                                                return (
                                                    <TableRow key={record.id}>
                                                        <TableCell className="font-medium">
                                                            #{record.recordNumber}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {formatCurrency(record.totalDue)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max={record.totalDue}
                                                                value={allocated || ''}
                                                                onChange={(e) => handleManualChange(
                                                                    record.id,
                                                                    parseFloat(e.target.value) || 0
                                                                )}
                                                                className="w-28 text-right"
                                                                onFocus={(e) => e.target.select()}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right text-muted-foreground">
                                                            {formatCurrency(remaining)}
                                                        </TableCell>
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
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                        >
                            Cancel
                        </Button>
                        <SubmitButton disabled={sumMismatch || totalAmount <= 0 || totalAmount > customer.totalDues}>
                            {isWaiver ? 'Apply Discount' : 'Process Payment'}
                        </SubmitButton>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
