'use client';

import { useState } from 'react';
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
import { Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Customer } from "@/lib/definitions";

interface StorageRecord {
    id: string;
    commodityDescription: string;
    location: string;
    bagsStored: number;
    bagsIn?: number;
    storageStartDate: string | Date;
    hamaliPayable: number;
    storageEndDate?: string | Date | null;
    customerId?: string;
    cropId?: string;
    lotId?: string;
    lorryTractorNo?: string;
    inflowType?: 'purchase' | 'transfer_in' | 'return' | 'other';
}

interface Props {
    record: StorageRecord;
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    customers?: Customer[];
    crops?: any[];
    lots?: any[];
    userRole?: string;
    children?: React.ReactNode;
}

export function EditStorageDialog({ 
    record, 
    variant = 'outline', 
    size = 'sm',
    customers = [],
    crops = [],
    lots = [],
    userRole = 'staff',
    children
}: Props) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    // Can't edit if already completed (has end date)
    const isCompleted = !!record.storageEndDate;

    // Auto-calculate Hamali logic
    const initialBags = record.bagsIn || record.bagsStored || 0;
    const initialHamali = record.hamaliPayable || 0;
    const ratePerBag = initialBags > 0 ? (initialHamali / initialBags) : 0;

    const [bags, setBags] = useState<string | number>(initialBags);
    const [hamali, setHamali] = useState<string | number>(initialHamali);
    // Location is the printed "LOT NO." When the admin picks a Lot from the
    // dropdown, keep this in sync so the user sees the new lot number before saving.
    const [location, setLocation] = useState<string>(record.location || '');

    const handleBagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newBags = e.target.value;
        setBags(newBags);
        
        // Auto-calc hamali
        if (ratePerBag > 0 && newBags) {
            const numBags = parseFloat(newBags);
            if (!isNaN(numBags)) {
                setHamali((numBags * ratePerBag).toFixed(2));
            }
        }
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);
        
        try {
            const response = await fetch('/api/storage/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: record.id,
                    commodityDescription: formData.get('commodityDescription'),
                    location: formData.get('location'),
                    bagsStored: parseInt(formData.get('bagsStored') as string),
                    hamaliPayable: parseFloat(formData.get('hamaliPayable') as string),
                    storageStartDate: formData.get('storageStartDate'),
                    customerId: formData.get('customerId'),
                    cropId: formData.get('cropId'),
                    lotId: formData.get('lotId'),
                    lorryTractorNo: formData.get('lorryTractorNo'),
                    inflowType: formData.get('inflowType'),
                })
            });

            // Client-side date check (though we can't fully check EndDate here as it's not editable in this form usually, checks happen in database or separate action if closing).
            // But if we were editing an End Date, we'd check it.
            // This form actually only edits active records or basic details.
            // Wait, looking at the code, `isCompleted` disables the form.
            // If we are editing the Start Date, we should ensure it's not in the future.
            const sDate = new Date(formData.get('storageStartDate') as string);
            if (sDate > new Date()) {
                 setError('Storage Start Date cannot be in the future.');
                 setLoading(false);
                 return;
            }

            const result = await response.json();

            if (result.success) {
                setOpen(false);
                router.refresh();
            } else {
                setError(result.message || 'Failed to update record');
            }
        } catch (err) {
            setError('An error occurred while updating');
        }

        setLoading(false);
    }

    if (isCompleted) {
        return (
            <Button variant={variant} size={size} disabled title="Cannot edit completed records">
                <Pencil className="h-4 w-4 mr-2" />
                Edit
            </Button>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children ? children : (
                    <Button variant={variant} size={size}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Storage Record</DialogTitle>
                        <DialogDescription>
                            Update storage record details. {isCompleted ? 'Cannot edit completed records.' : ''}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                        {/* Admin Only Fields */}
                        {(userRole === 'admin' || userRole === 'owner' || userRole === 'super_admin') && (
                            <div className="space-y-4 border-b pb-4 mb-2">
                                <h4 className="text-sm font-semibold text-muted-foreground">Admin Overrides</h4>
                                
                                <div className="grid gap-2">
                                    <Label htmlFor="customerId">Customer</Label>
                                    <Select name="customerId" defaultValue={record.customerId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Customer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customers.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                     <div className="grid gap-2">
                                        <Label htmlFor="cropId">Crop</Label>
                                        <Select name="cropId" defaultValue={record.cropId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Crop" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {crops.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="lotId">Lot</Label>
                                        <Select name="lotId" defaultValue={record.lotId} onValueChange={(lotId) => {
                                            const lot = lots.find(l => l.id === lotId);
                                            if (lot) setLocation(lot.name);
                                        }}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Lot" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {lots.map(l => (
                                                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="lorryTractorNo">Vehicle No.</Label>
                                    <Input 
                                        id="lorryTractorNo" 
                                        name="lorryTractorNo" 
                                        defaultValue={record.lorryTractorNo || ''} 
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Inflow Type</Label>
                                    <RadioGroup name="inflowType" defaultValue={record.inflowType || 'purchase'} className="flex flex-row space-x-4">
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="purchase" id="r1" />
                                            <Label htmlFor="r1">Direct</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="transfer_in" id="r2" />
                                            <Label htmlFor="r2">Plot (Drying)</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                            </div>
                        )}
                        {/* Common Fields */}
                        {/* Common Fields */}
                        <div className="grid gap-2">
                            <Label htmlFor="commodityDescription">Commodity Description *</Label>
                            <Input
                                id="commodityDescription"
                                name="commodityDescription"
                                defaultValue={record.commodityDescription}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="location">Location *</Label>
                            <Input
                                id="location"
                                name="location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="bagsStored">Number of Bags (Initial Inflow) *</Label>
                            <Input
                                id="bagsStored"
                                name="bagsStored"
                                type="number"
                                value={bags}
                                onChange={handleBagsChange}
                                required
                                min="1"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="hamaliPayable">Hamali Payable</Label>
                            <Input
                                id="hamaliPayable"
                                name="hamaliPayable"
                                type="number"
                                step="0.01"
                                value={hamali}
                                onChange={(e) => setHamali(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Rate: ₹{ratePerBag.toFixed(2)} / bag (Auto-calculated)
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="storageStartDate">Storage Start Date *</Label>
                            <Input
                                id="storageStartDate"
                                name="storageStartDate"
                                type="date"
                                defaultValue={
                                    typeof record.storageStartDate === 'string'
                                        ? record.storageStartDate.split('T')[0]
                                        : new Date(record.storageStartDate).toISOString().split('T')[0]
                                }
                                required
                            />
                        </div>
                    </div>
                    {error && (
                        <p className="text-sm text-destructive mb-4">{error}</p>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
