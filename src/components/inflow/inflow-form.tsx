
'use client';

import { useEffect, useState, Suspense } from 'react';

import { useSearchParams, useRouter } from 'next/navigation';

import { SubmitButton } from '@/components/ui/submit-button';
import { addInflow } from '@/lib/actions/storage/inflow';
// ... (rest of imports unchanged)
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Separator } from '../ui/separator';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

// Local SubmitButton removed in favor of shared component


import { useCustomers } from "@/contexts/customer-context";
import { useStaticData } from "@/hooks/use-static-data";
import { usePreventNavigation } from "@/hooks/use-prevent-navigation";
import { useServerAction } from "@/hooks/use-server-action";

interface InflowFormInnerProps {
    nextSerialNumber: string;
    onSuccess?: (inflow: any) => void;
    smsEnabledDefault: boolean;
    customers: any[];
    crops: any[];
    lots: any[];
    initialUnloadingRecords?: any[];
    selectedUnloadingId?: string;
}

function InflowFormInner({ 
    nextSerialNumber, 
    onSuccess, 
    smsEnabledDefault,
    customers: propCustomers,
    crops: propCrops,
    lots: propLots,
    initialUnloadingRecords = [],
    selectedUnloadingId: propSelectedUnloadingId
}: InflowFormInnerProps) {

    const searchParams = useSearchParams();
    const queryCustomerId = searchParams.get('customerId');
    
    // Use props as initial data if available, otherwise fallback to hooks
    const { customers: hookCustomers } = useCustomers();
    const { crops: hookCrops, lots: hookLots, refresh } = useStaticData();

    const customers = propCustomers.length > 0 ? propCustomers : hookCustomers;
    const crops = propCrops.length > 0 ? propCrops : hookCrops;
    const lots = propLots.length > 0 ? propLots : hookLots;

    const { runAction, isPending } = useServerAction();
    
    // Prevent navigation while pending
    usePreventNavigation(isPending);
    
    const router = useRouter();

    const [bags, setBags] = useState(0);
    const [rate, setRate] = useState(0);
    const [hamali, setHamali] = useState(0);
    const [hamaliPaid, setHamaliPaid] = useState(0);
    const [selectedCustomerId, setSelectedCustomerId] = useState(queryCustomerId || '');
    const [inflowType, setInflowType] = useState<'purchase' | 'transfer_in'>('purchase');
    const [plotBags, setPlotBags] = useState(0);
    const [loadBags, setLoadBags] = useState(0);
    const [selectedLotId, setSelectedLotId] = useState('');
    const [selectedCropId, setSelectedCropId] = useState('');
    const [sendSms] = useState(smsEnabledDefault);
    const [unloadingRecords, setUnloadingRecords] = useState<any[]>(initialUnloadingRecords);
    const [selectedUnloadingId, setSelectedUnloadingId] = useState(propSelectedUnloadingId || '');

    // Sync prop changes
    useEffect(() => {
        if (propSelectedUnloadingId) {
             setSelectedUnloadingId(propSelectedUnloadingId);
        }
    }, [propSelectedUnloadingId]);
    
    // ... (rest of logic) ...

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    const selectedLot = lots?.find(l => l.id === selectedLotId);
    const selectedCrop = crops?.find(c => c.id === selectedCropId);
    const selectedUnloading = unloadingRecords.find(u => u.id === selectedUnloadingId);

    // Auto-populate from selected unloading record
    useEffect(() => {
        if (selectedUnloading) {
            setSelectedCustomerId(selectedUnloading.customer_id);
            if (selectedUnloading.crop_id) {
                setSelectedCropId(selectedUnloading.crop_id);
            }
            if (selectedUnloading.bags_remaining) {
                setBags(selectedUnloading.bags_remaining);
            }
        }
    }, [selectedUnloading]);

    // Sync unloading records when prop updates (e.g. after adding new truck arrival)
    useEffect(() => {
        setUnloadingRecords(initialUnloadingRecords);
    }, [initialUnloadingRecords]);


    useEffect(() => {
        // Hamali charging rule:
        // - Plot inflow linked to unloading → ALL hamali (stacking + unloading share)
        //   on plot bags (gross, pre-drying) since labor was done on all bags.
        // - Plot inflow without unloading link → stacking on loadBags (actual stored).
        // - Direct inflow → on bags (bagsStored); no drying stage.
        const rateValue = rate || 0;
        const hasUnloadingLink = !!selectedUnloading;
        const stackingBags = inflowType === 'transfer_in'
            ? (hasUnloadingLink ? plotBags : (loadBags > 0 ? loadBags : plotBags))
            : bags;

        let calculatedHamali = (stackingBags || 0) * rateValue;

        // Unloading carry-over share
        if (selectedUnloading && selectedUnloading.hamali_amount && selectedUnloading.bags_unloaded > 0) {
            const unloadingRate = selectedUnloading.hamali_amount / selectedUnloading.bags_unloaded;
            const unloadingBagsToCharge = inflowType === 'transfer_in' ? plotBags : bags;
            calculatedHamali += (unloadingBagsToCharge || 0) * unloadingRate;
        }

        setHamali(calculatedHamali);
    }, [bags, plotBags, loadBags, rate, inflowType, selectedUnloading]);


    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (formData: FormData) => {
        // Client-side validation
        const tParams = {
            customerId: selectedCustomerId,
            lot: selectedLotId,
            crop: selectedCropId,
            bags: (inflowType === 'purchase' ? bags : 0),
            plotBags: (inflowType === 'transfer_in' ? plotBags : 0),
            type: inflowType,
        };

        let errMsg: string | null = null;

        if (!tParams.customerId) errMsg = 'Please select a Customer.';
        else if (!tParams.lot) errMsg = 'Please select a Lot.';
        else if (!tParams.crop) errMsg = 'Please select a Crop.';
        
        else if (tParams.type === 'purchase') {
             if (!tParams.bags || tParams.bags <= 0) errMsg = 'Number of bags must be valid and greater than 0.';
        } else if (tParams.type === 'transfer_in') {
             if (!tParams.plotBags || tParams.plotBags <= 0) errMsg = 'Plot bags must be valid and greater than 0.';
        }

        const dateVal = formData.get('storageStartDate');
        if (!dateVal || isNaN(Date.parse(dateVal.toString()))) {
             errMsg = 'Please enter a valid date.';
        }

        if (errMsg) {
            setError(errMsg);
            // Scroll to top to see error
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        } 
        
        setError(null);
        
        await runAction(async () => {
             const result = await addInflow({ message: '', success: false }, formData); // Pass initial state as addInflow expects previous state
             
             // If result is undefined/null, it means a redirect happened (success).
             // Only throw if we have a concrete failure result.
             if (result && !result.success) {
                  throw new Error(result.message);
             }
             return result;
        }, {
             // blocking: false, // Reverted to local button loading per user request
             successMessage: 'Inflow recorded successfully!',
             onSuccess: (result) => {
                  if (onSuccess && result.data) {
                      onSuccess(result.data);
                  }
                  router.refresh();
                  refresh();
             }
        });
    };

  return (
    <div className="flex justify-center">
        <form action={handleSubmit} className="w-full max-w-lg">
            <fieldset disabled={isPending} className="contents">
                <Card>
                    <CardHeader>
                        <CardTitle>New Storage Record Details</CardTitle>
                        <CardDescription>
                            Next Serial No: <span data-testid="next-serial-number" className="font-bold text-primary">Auto-Generated ({nextSerialNumber})</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className={`space-y-4 transition-opacity duration-200 ${isPending ? 'opacity-50' : ''}`}>
                    {/* Error Alert */}
                    {error && (
                         <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md mb-4 border border-destructive/20">
                            {error}
                         </div>
                    )}

                    {/* Unloading Record Selector */}
                    {unloadingRecords.length > 0 && (
                        <div className="space-y-2 p-3 sm:p-4 bg-accent/50 rounded-lg border">
                            <Label htmlFor="unloadingRecord" className="text-sm">
                                Select from Unloading Record (Optional)
                            </Label>
                            <Select 
                                value={selectedUnloadingId} 
                                onValueChange={(value) => {
                                    setSelectedUnloadingId(value);
                                    if (!value) {
                                        // Clear selection
                                        setSelectedCustomerId('');
                                        setSelectedCropId('');
                                    }
                                }}
                            >
                                <SelectTrigger id="unloadingRecord" className="text-sm">
                                    <SelectValue placeholder="Choose from truck arrivals..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_none_">-- None (Manual Entry) --</SelectItem>
                                    {unloadingRecords.map(record => (
                                        <SelectItem key={record.id} value={record.id} className="text-sm">
                                            <span className="block truncate">
                                                {record.customer?.name} - {record.commodity_description}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {record.bags_remaining} bags
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedUnloading && (
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                                        <span>Available: {selectedUnloading.bags_remaining} bags</span>
                                        <span>Unloaded: {new Date(selectedUnloading.unload_date).toLocaleDateString()}</span>
                                    </div>
                                    {selectedUnloading.lorry_tractor_no && (
                                        <div className="break-all">{selectedUnloading.lorry_tractor_no}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="customerId">Customer <span className="text-destructive">*</span></Label>
                        <Select 
                            key={selectedCustomerId || 'customer-select'} 
                            name="customerId" 
                            required 
                            onValueChange={setSelectedCustomerId} 
                            value={selectedCustomerId}
                        >
                            <SelectTrigger id="customerId">
                                <SelectValue placeholder="Select a customer" />
                            </SelectTrigger>
                            <SelectContent>
                                {customers.map(customer => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                        {customer.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedCustomer && (
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fatherName">Father's Name</Label>
                                <Input 
                                    key={`father-${selectedCustomerId}`}
                                    id="fatherName" 
                                    name="fatherName" 
                                    defaultValue={(selectedCustomer as any).father_name || selectedCustomer.fatherName || ''} 
                                    readOnly
                                    className="bg-muted"
                                />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="village">Village</Label>
                                <Input 
                                    key={`village-${selectedCustomerId}`}
                                    id="village" 
                                    name="village" 
                                    defaultValue={selectedCustomer.village || ''} 
                                    readOnly
                                    className="bg-muted"
                                />
                            </div>
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <Label>Inflow Type</Label>
                        <RadioGroup 
                            name="inflowType"
                            defaultValue="purchase"
                            className="flex gap-4"
                            onValueChange={(value: 'purchase' | 'transfer_in') => setInflowType(value)}
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="purchase" id="direct" />
                                <Label htmlFor="direct">Direct (Purchase)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="transfer_in" id="plot" />
                                <Label htmlFor="plot">Plot (Transfer In)</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {inflowType === 'transfer_in' && (
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="plotBags">Plot Bags <span className="text-destructive">*</span></Label>
                                <Input 
                                    id="plotBags" 
                                    name="plotBags" 
                                    type="number" 
                                    min="1"
                                    placeholder="0" 
                                    required
                                    onFocus={(e) => e.target.select()}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={e => setPlotBags(Number(e.target.value))} 
                                />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="loadBags">Load Bags (Final)</Label>
                                <Input
                                    id="loadBags"
                                    name="loadBags"
                                    type="number"
                                    min="1"
                                    placeholder="0"
                                    onFocus={(e) => e.target.select()}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={e => setLoadBags(Number(e.target.value))}
                                />
                            </div>
                        </div>
                    )}


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="cropId">Product / Crop <span className="text-destructive">*</span></Label>
                            <Select 
                                key={selectedCropId || 'crop-select'} 
                                name="cropId" 
                                required 
                                onValueChange={val => {
                                    setSelectedCropId(val);
                                }} 
                                value={selectedCropId}
                            >
                                <SelectTrigger id="cropId">
                                    <SelectValue placeholder="Select Crop" />
                                </SelectTrigger>
                                <SelectContent>
                                    {crops && crops.map(crop => (
                                        <SelectItem key={crop.id} value={crop.id}>
                                            {crop.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <input type="hidden" name="commodityDescription" value={selectedCrop ? selectedCrop.name : ''} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lotId">Lot No. <span className="text-destructive">*</span></Label>
                            <Select 
                                key={selectedLotId || 'lot-select'} 
                                name="lotId" 
                                required 
                                onValueChange={setSelectedLotId} 
                                value={selectedLotId}
                            >
                                <SelectTrigger id="lotId">
                                    <SelectValue placeholder="Select Lot" />
                                </SelectTrigger>
                                <SelectContent>
                                    {lots && lots.map(lot => {
                                        const capacity = lot.capacity || 1000;
                                        const current = lot.current_stock || 0;
                                        const available = capacity - current;
                                        return (
                                            <SelectItem key={lot.id} value={lot.id} disabled={available <= 0}>
                                                {lot.name} (Available: {available})
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                            <input type="hidden" name="location" value={selectedLot ? selectedLot.name : ''} />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="lorryTractorNo">Lorry / Tractor No.</Label>
                            <Input id="lorryTractorNo" name="lorryTractorNo" placeholder="e.g., AP 21 1234" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="storageStartDate">Date <span className="text-destructive">*</span></Label>
                            <Input 
                                id="storageStartDate" 
                                name="storageStartDate" 
                                type="date"
                                defaultValue={new Date().toISOString().split('T')[0]}
                                required 
                            />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        {inflowType === 'purchase' && (
                            <div className="space-y-2">
                                <Label htmlFor="bagsStored">No. of Bags <span className="text-destructive">*</span></Label>
                                <Input 
                                    id="bagsStored" 
                                    name="bagsStored" 
                                    type="number" 
                                    placeholder="0" 
                                    required 
                                    min="1"
                                    onFocus={(e) => e.target.select()}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={e => setBags(Number(e.target.value))}
                                />
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="hamaliRate">Hamali Rate (per bag)</Label>
                            <Input id="hamaliRate" name="hamaliRate" type="number" placeholder="0.00" step="0.01" onFocus={(e) => e.target.select()} onWheel={(e) => e.currentTarget.blur()} onChange={e => setRate(Number(e.target.value))}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="hamaliPaid">Hamali Paid Now</Label>
                            <Input id="hamaliPaid" name="hamaliPaid" type="number" placeholder="0.00" step="0.01" onFocus={(e) => e.target.select()} onWheel={(e) => e.currentTarget.blur()} onChange={e => setHamaliPaid(Number(e.target.value))}/>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="khataAmount">Khata Amount (Weighbridge)</Label>
                        <Input id="khataAmount" name="khataAmount" type="number" placeholder="0.00" step="0.01" onFocus={(e) => e.target.select()} onWheel={(e) => e.currentTarget.blur()} />
                    </div>
                     <Separator />
                    <div className="space-y-4">
                        <h4 className="font-medium">Billing Summary</h4>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Total Hamali Payable</span>
                                <div className="text-right">
                                    <span className="font-mono block">₹{hamali.toFixed(2)}</span>
                                    {selectedUnloading && <span className="text-[10px] text-muted-foreground block leading-tight">(Includes Unloading)</span>}
                                </div>
                            </div>
                            <div className="flex justify-between items-center font-semibold text-base">
                                <span className="text-destructive">Hamali Pending</span>
                                <span className="font-mono text-destructive">₹{(hamali - hamaliPaid).toFixed(2)}</span>
                            </div>
                             {selectedCrop && (
                                <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t">
                                    <span className="text-muted-foreground">Est. Rent (6 Months)</span>
                                    <span className="font-mono">₹{selectedCrop.rent_price_6m} / bag</span>
                                </div>
                            )}
                            {selectedCrop && (selectedCrop.insurance_per_bag ?? 0) > 0 && (() => {
                                // Insurance is charged on the final stored qty (loadBags for plot, bags for direct)
                                const insuranceBags = inflowType === 'transfer_in'
                                    ? (loadBags > 0 ? loadBags : plotBags)
                                    : (bags || 0);
                                const insuranceTotal = insuranceBags * (selectedCrop.insurance_per_bag || 0);
                                return (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Insurance ({insuranceBags} bags × ₹{selectedCrop.insurance_per_bag}/bag)</span>
                                        <span className="font-mono text-blue-700">₹{insuranceTotal.toFixed(2)}</span>
                                    </div>
                                );
                            })()}
                            <p className="text-xs text-muted-foreground">
                                Rent will be calculated at the time of withdrawal.
                            </p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-4">
                    <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                    <SubmitButton isLoading={isPending}>Create Storage Record</SubmitButton>
                </CardFooter>
            </Card>
            </fieldset>
            {/* Hidden Fields */}
            <input type="hidden" name="customerId" value={selectedCustomerId} />
            <input type="hidden" name="inflowType" value={inflowType} />
            <input type="hidden" name="unloadingRecordId" value={selectedUnloadingId || ''} />
            <input type="hidden" name="sendSms" value={String(sendSms)} />
        </form>
    </div>
  );
}

interface InflowFormProps {
    nextSerialNumber: string;
    onSuccess?: (inflow: any) => void;
    smsEnabledDefault: boolean;
    customers: Array<{ id: string; name: string }>;
    crops: Array<{ id: string; name: string }>;
    lots: Array<{ id: string; name: string; capacity: number; current_stock: number; commodity_description?: string }>;
    initialUnloadingRecords?: any[];
    selectedUnloadingId?: string;
}

export function InflowForm({ 
    nextSerialNumber, 
    onSuccess, 
    smsEnabledDefault, 
    customers, 
    crops, 
    lots, 
    initialUnloadingRecords = [],
    selectedUnloadingId
}: InflowFormProps) {
    return (
        <Suspense fallback={<Card className="w-full animate-pulse h-96" />}>
            <InflowFormInner 
                nextSerialNumber={nextSerialNumber} 
                onSuccess={onSuccess} 
                smsEnabledDefault={smsEnabledDefault} 
                customers={customers}
                crops={crops}
                lots={lots}
                initialUnloadingRecords={initialUnloadingRecords}
                selectedUnloadingId={selectedUnloadingId}
            />
        </Suspense>
    );
}
