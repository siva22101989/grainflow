'use client';

import {  useEffect, useState, startTransition } from 'react';
import { SubmitButton } from "@/components/ui/submit-button";
import { addOutflow } from '@/lib/actions/storage/outflow';
// ...
import { getStorageRecordAction } from '@/lib/actions/storage/records';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { StorageRecord } from '@/lib/definitions';
import { useUnifiedToast } from '@/components/shared/toast-provider';
import { Separator } from '../ui/separator';
import { calculateFinalRent } from '@/lib/billing';
import { format } from 'date-fns';
import { toDate } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useStaticData } from '@/hooks/use-static-data';
import { useServerAction } from '@/hooks/use-server-action';
import { AsyncRecordSelector } from './async-record-selector';

export function OutflowForm({ 
    onSuccess,
    smsEnabledDefault
}: { 
    onSuccess?: (outflow: any) => void,
    smsEnabledDefault: boolean
}) {
    const { success: _toastSuccess, error: toastError } = useUnifiedToast();
    
    // Hooks for data
    // const { customers, isLoading: customersLoading } = useCustomers();
    const { crops } = useStaticData(); 
    const { runAction, isPending } = useServerAction();
    
    const [selectedRecordId, setSelectedRecordId] = useState<string>('');
    const [selectedRecord, setSelectedRecord] = useState<StorageRecord | null>(null);
    const [bagsToWithdraw, setBagsToWithdraw] = useState(0);
    const [withdrawalDate, setWithdrawalDate] = useState(new Date());
    
    const [standardRent, setStandardRent] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [storageMonths, setStorageMonths] = useState(0);
    const [hamaliPending, setHamaliPending] = useState(0);
    const [advanceAmount, setAdvanceAmount] = useState(0);
    const [isLoadingRecord, setIsLoadingRecord] = useState(false);
    const [sendSms] = useState(smsEnabledDefault);

    // Calculate net rent based on discount
    const netRent = Math.max(0, standardRent - discount);
    const totalPayable = Math.max(0, netRent + hamaliPending - advanceAmount);

    // Breakdown of the prior (inflow) charges that make up "Previous Balance",
    // so insurance is visible instead of being lumped into one number.
    // priorHamali + priorInsurance + priorRent - priorPaid === hamaliPending
    // whenever hamaliPending > 0.
    const priorHamali = selectedRecord?.hamaliPayable || 0;
    const priorInsurance = selectedRecord?.insurancePayable || 0;
    const priorRent = selectedRecord?.totalRentBilled || 0;
    const priorPaid = (selectedRecord?.payments || []).reduce((acc, p) => acc + p.amount, 0);

    const handleRecordSelect = async (recordId: string) => {
        setSelectedRecordId(recordId);
        if(!recordId) {
             setSelectedRecord(null);
             return;
        }

        setIsLoadingRecord(true);
        try {
            const record = await getStorageRecordAction(recordId);
            if(record) {
                setSelectedRecord(record);
            }
        } catch(e) {
            toastError("Error", "Failed to load record details");
        } finally {
            setIsLoadingRecord(false);
        }
    };

    useEffect(() => {
        if (selectedRecord) {
            const amountPaid = (selectedRecord.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const totalBilledSoFar =
                selectedRecord.hamaliPayable +
                (selectedRecord.totalRentBilled || 0) +
                (selectedRecord.insurancePayable || 0);
            const pending = totalBilledSoFar - amountPaid;
            
            if (pending > 0) {
                setHamaliPending(pending);
                setAdvanceAmount(0);
            } else {
                setHamaliPending(0);
                setAdvanceAmount(Math.abs(pending));
            }
            
            const safeRecord = {
                ...selectedRecord,
                storageStartDate: toDate(selectedRecord.storageStartDate)
            };

            // Find crop pricing if available
            let pricing = undefined;
            let pricingSlabs = undefined;
            if (selectedRecord.cropId && crops) {
                const crop = crops.find(c => c.id === selectedRecord.cropId);
                if (crop) {
                    pricing = {
                        price6m: crop.rent_price_6m,
                        price1y: crop.rent_price_1y
                    };
                    pricingSlabs = crop.pricing_slabs || undefined;
                }
            }

            if (bagsToWithdraw > 0) {
                const { rent, monthsStored } = calculateFinalRent(safeRecord, withdrawalDate, bagsToWithdraw, pricing, pricingSlabs);
                setStandardRent(rent);
                setStorageMonths(monthsStored);
            } else {
                setStandardRent(0);
                setStorageMonths(0);
            }
        } else {
            setStandardRent(0);
            setStorageMonths(0);
            setHamaliPending(0);
            setAdvanceAmount(0);
        }
    }, [selectedRecord, bagsToWithdraw, withdrawalDate, crops]);
    
    // Removed handleCustomerChange


    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateValue = e.target.valueAsDate ? new Date(e.target.valueAsDate.valueOf() + e.target.valueAsDate.getTimezoneOffset() * 60 * 1000) : new Date();
        setWithdrawalDate(dateValue);
    }

    const handleSubmit = async (formData: FormData) => {
        if (!selectedRecordId) {
             // Standard unified toast from context
             toastError('Error', 'Please select a storage record to withdraw from.');
             return;
        }
        if (bagsToWithdraw <= 0 || isNaN(bagsToWithdraw)) {
            toastError('Error', 'Please enter a valid number of bags.');
            return;
        }
         if (selectedRecord && bagsToWithdraw > selectedRecord.bagsStored) {
            toastError('Error', `Cannot withdraw more than stored (${selectedRecord.bagsStored} bags).`);
            return;
        }

        await runAction(async () => {
             const result = await addOutflow({ message: '', success: false }, formData); // Pass initial state as addOutflow expects previous state
             
             // If result is undefined/null, it means a redirect happened (success).
             // Only throw if we have a concrete failure result.
             if (result && !result.success) {
                  throw new Error(result.message);
             }
             return result;
        }, {
             // blocking: false, // Reverted to local button loading per user request
             onSuccess: () => {
                  if (onSuccess && selectedRecord) {
                    startTransition(() => {
                        onSuccess({
                            id: 'optimistic-' + Date.now(),
                            date: withdrawalDate,
                            customerName: selectedRecord.customerName || 'Customer', // Corrected property name
                            commodity: selectedRecord.commodityDescription || 'Product',
                            bags: bagsToWithdraw,
                            totalAmount: totalPayable
                        });
                    });
                  }
                  // Action will redirect, so we don't need manual router.push here
             }
        });
    };

  return (
    <div className="flex justify-center">
        <form action={handleSubmit} className="w-full max-w-lg">
            <fieldset disabled={isPending} className="contents">
                <Card>
                    <CardHeader>
                    <CardTitle>Withdrawal Details</CardTitle>
                    <CardDescription>Select a customer, then choose a record and enter withdrawal information.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                    {/* Standardized Error Alert */}
                    {/* Standardized Error Alert - handled by toast usually, but can keep if we have local error state */}
                    {/* <FormError message={!state.success ? state.message : undefined} className="mb-4" /> */}
                    <div className="space-y-2">
                        <Label>Search Record</Label>
                        <AsyncRecordSelector onSelect={handleRecordSelect} />
                        {/* Hidden Inputs for Form Action */}
                        <input type="hidden" name="customerId" value={selectedRecord?.customerId || ''} />
                        <input type="hidden" name="recordId" value={selectedRecordId} />
                        <input type="hidden" name="sendSms" value={String(sendSms)} />
                    </div>
                    
                    {isLoadingRecord && (
                        <div className="flex justify-center p-4 text-muted-foreground text-sm">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading details...
                        </div>
                    )}


                    {selectedRecord && (
                        <>
                             <div className="text-sm text-muted-foreground p-2 bg-secondary/50 rounded-md">
                                Inflow Date: <span className="font-medium text-foreground">{format(toDate(selectedRecord.storageStartDate), 'dd MMM yyyy')}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bagsToWithdraw">Bags to Withdraw</Label>
                                    <Input 
                                        id="bagsToWithdraw" 
                                        name="bagsToWithdraw" 
                                        type="number" 
                                        placeholder="0"
                                        min="1"
                                        max={selectedRecord.bagsStored}
                                        required 
                                        onFocus={(e) => e.target.select()}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        onChange={e => setBagsToWithdraw(Number(e.target.value))}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Max: <span data-testid="bags-stored">{selectedRecord.bagsStored}</span> bags
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="withdrawalDate">Withdrawal Date</Label>
                                    <Input 
                                        id="withdrawalDate" 
                                        name="withdrawalDate" 
                                        type="date"
                                        defaultValue={new Date().toISOString().split('T')[0]}
                                        required
                                        onChange={handleDateChange}
                                     />
                                </div>
                            </div>
                            <Separator />
                            <div className="space-y-4">
                                <h4 className="font-medium">Final Billing Summary</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Storage Duration</span>
                                        <span className="font-mono">{storageMonths} months</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Standard Rent</span>
                                        <span className="font-mono">₹{standardRent.toFixed(2)}</span>
                                    </div>
                                    
                                    <div className="space-y-1">
                                         <Label htmlFor="discount" className="text-xs text-muted-foreground">Discount</Label>
                                         <Input 
                                            id="discount" 
                                            name="discount" 
                                            type="number" 
                                            placeholder="0" 
                                            min="0"
                                            value={discount}
                                            onChange={(e) => setDiscount(Number(e.target.value))}
                                            className="h-8"
                                        />
                                    </div>

                                    <div className="flex justify-between items-center text-sm font-medium">
                                        <span className="text-muted-foreground">Net Rent Due</span>
                                        <span className="font-mono" data-testid="calculated-rent">₹{netRent.toFixed(2)}</span>
                                    </div>

                                    {hamaliPending > 0 ? (
                                        <div className="space-y-1 border-t pt-2">
                                            <span className="text-xs font-medium text-muted-foreground">Previous Balance</span>
                                            <div className="flex justify-between items-center text-xs pl-3">
                                                <span className="text-muted-foreground">Prior Hamali</span>
                                                <span className="font-mono">₹{priorHamali.toFixed(2)}</span>
                                            </div>
                                            {priorInsurance > 0 && (
                                                <div className="flex justify-between items-center text-xs pl-3">
                                                    <span className="text-muted-foreground">Prior Insurance</span>
                                                    <span className="font-mono">₹{priorInsurance.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {priorRent > 0 && (
                                                <div className="flex justify-between items-center text-xs pl-3">
                                                    <span className="text-muted-foreground">Prior Rent</span>
                                                    <span className="font-mono">₹{priorRent.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center text-xs pl-3">
                                                <span className="text-muted-foreground">Already Paid</span>
                                                <span className="font-mono">- ₹{priorPaid.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm font-medium pl-3">
                                                <span className="text-muted-foreground">Balance</span>
                                                <span className="font-mono">₹{hamaliPending.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Previous Balance</span>
                                            <span className="font-mono">₹{hamaliPending.toFixed(2)}</span>
                                        </div>
                                    )}

                                    {advanceAmount > 0 && (
                                        <div className="flex justify-between items-center text-sm font-medium text-emerald-600 dark:text-emerald-500">
                                            <span>Prior Credit / Advance</span>
                                            <span className="font-mono">- ₹{advanceAmount.toFixed(2)}</span>
                                        </div>
                                    )}

                                    <Separator />
                                    <div className="flex justify-between items-center font-semibold text-lg">
                                        <span className="text-foreground">Total Payable</span>
                                        <span className="font-mono" data-testid="total-payable">₹{totalPayable.toFixed(2)}</span>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="amountPaidNow">Total Paid Now</Label>
                                        <Input
                                            id="amountPaidNow"
                                            name="amountPaidNow"
                                            type="number"
                                            placeholder="0.00"
                                            step="0.01"
                                            min="0"
                                            onFocus={(e) => e.target.select()}
                                            onWheel={(e) => e.currentTarget.blur()}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Enter the amount paid by the customer. Leave blank if unpaid.
                                        </p>
                                    </div>
                                </div>
                                <input type="hidden" name="finalRent" value={netRent} />
                            </div>
                        </>
                    )}
                </CardContent>
                <CardFooter className="flex justify-end">
                    <SubmitButton isLoading={isPending}>Process Outflow</SubmitButton>
                </CardFooter>
            </Card>
            </fieldset>
        </form>
    </div>
  );
}
