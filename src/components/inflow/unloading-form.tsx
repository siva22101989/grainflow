'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { recordUnloading } from '@/lib/unloading-actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TruckIcon } from 'lucide-react';

interface UnloadingFormProps {
    customers: Array<{ id: string; name: string }>;
    crops: Array<{ id: string; name: string }>;
}

export function UnloadingForm({ customers, crops }: UnloadingFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    // Radix Select doesn't reset with form.reset() — we have to control it ourselves
    // to guarantee a clean form after each successful submission.
    const [customerId, setCustomerId] = useState<string>('');
    const [cropId, setCropId] = useState<string>('');
    // formKey bumps on successful submit to force-remount native inputs
    // (so the number/text fields also clear reliably)
    const [formKey, setFormKey] = useState(0);
    const { toast } = useToast();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);

        const data = {
            customerId,
            commodityDescription: formData.get('commodityDescription') as string,
            cropId: cropId || undefined,
            bagsUnloaded: parseInt(formData.get('bagsUnloaded') as string),
            lorryTractorNo: formData.get('lorryTractorNo') as string || undefined,
            notes: formData.get('notes') as string || undefined,
            hamaliAmount: formData.get('hamaliAmount') ? parseFloat(formData.get('hamaliAmount') as string) : 0,
        };

        if (!data.customerId) {
            toast({ title: 'Error', description: 'Please select a customer.', variant: 'destructive' });
            setIsLoading(false);
            return;
        }
        if (!data.cropId) {
            toast({ title: 'Error', description: 'Please select a commodity.', variant: 'destructive' });
            setIsLoading(false);
            return;
        }
        if (!data.bagsUnloaded || isNaN(data.bagsUnloaded) || data.bagsUnloaded <= 0) {
            toast({ title: 'Error', description: 'Please enter a valid number of bags.', variant: 'destructive' });
            setIsLoading(false);
            return;
        }

        const result = await recordUnloading(data);

        if (result.success) {
            toast({
                title: 'Success',
                description: `Recorded arrival of ${data.bagsUnloaded} bags for ${customers.find(c => c.id === customerId)?.name ?? 'customer'}`,
            });
            // Explicitly clear ALL fields — Radix Selects and native inputs
            setCustomerId('');
            setCropId('');
            setFormKey(k => k + 1);
        } else {
            toast({
                title: 'Error',
                description: result.error,
                variant: 'destructive',
            });
        }

        setIsLoading(false);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TruckIcon className="h-5 w-5" />
                    Record Truck Arrival
                </CardTitle>
                <CardDescription>
                    Track bags unloaded from truck (before assigning to plot or storage)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Customer */}
                        <div className="space-y-2">
                            <Label htmlFor="customerId">Customer *</Label>
                            <Select value={customerId} onValueChange={setCustomerId} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select customer" />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Commodity */}
                        <div className="space-y-2">
                            <Label htmlFor="cropId">Commodity *</Label>
                            <Select value={cropId} onValueChange={setCropId} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select commodity" />
                                </SelectTrigger>
                                <SelectContent>
                                    {crops.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Bags Unloaded */}
                        <div className="space-y-2">
                            <Label htmlFor="bagsUnloaded">Bags Unloaded *</Label>
                            <Input
                                type="number"
                                name="bagsUnloaded"
                                min="1"
                                required
                                placeholder="e.g., 1000"
                                onChange={(e) => {
                                    const bags = parseInt(e.target.value) || 0;
                                    const rateInput = document.getElementById('hamaliRate') as HTMLInputElement;
                                    const rate = parseFloat(rateInput?.value) || 0;
                                    const total = rate * bags;
                                    const totalInput = document.getElementById('hamaliTotalDisplay') as HTMLInputElement;
                                    const hiddenInput = document.getElementsByName('hamaliAmount')[0] as HTMLInputElement;
                                    if (totalInput) totalInput.value = total.toString();
                                    if (hiddenInput) hiddenInput.value = total.toString();
                                }}
                            />
                        </div>

                        {/* Hamali Rate & Total */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="hamaliRate">Hamali Rate (₹/bag)</Label>
                                <Input
                                    type="number"
                                    id="hamaliRate"
                                    min="0"
                                    step="any"
                                    placeholder="e.g. 5"
                                    onChange={(e) => {
                                        const rate = parseFloat(e.target.value) || 0;
                                        const bags = parseInt((document.getElementsByName('bagsUnloaded')[0] as HTMLInputElement)?.value) || 0;
                                        const total = rate * bags;
                                        const totalInput = document.getElementById('hamaliTotalDisplay') as HTMLInputElement;
                                        const hiddenInput = document.getElementsByName('hamaliAmount')[0] as HTMLInputElement;
                                        if (totalInput) totalInput.value = total.toString();
                                        if (hiddenInput) hiddenInput.value = total.toString();
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Total Hamali (₹)</Label>
                                <Input
                                    id="hamaliTotalDisplay"
                                    readOnly
                                    className="bg-muted"
                                    placeholder="0"
                                />
                                <input type="hidden" name="hamaliAmount" />
                            </div>
                        </div>

                        {/* Lorry/Tractor No */}
                        <div className="space-y-2">
                            <Label htmlFor="lorryTractorNo">Lorry/Tractor No</Label>
                            <Input
                                type="text"
                                name="lorryTractorNo"
                                placeholder="e.g., AP39T1234"
                            />
                        </div>
                    </div>

                    {/* Commodity Description (hidden, auto-filled from crop) */}
                    <input type="hidden" name="commodityDescription" value="Paddy" />

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            name="notes"
                            placeholder="Any additional notes..."
                            rows={2}
                        />
                    </div>

                    <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Recording...
                            </>
                        ) : (
                            'Record Arrival'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
