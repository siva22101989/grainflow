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
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { updateCrop } from '@/lib/lots-actions';
import { useRouter } from 'next/navigation';
import { useStaticData } from '@/hooks/use-static-data';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { validatePricingSlabs } from '@/lib/billing';
import type { PricingSlabConfig, PricingSlab } from '@/lib/definitions';

type PricingMode = 'standard' | 'minimum_monthly' | 'slabs';

interface Props {
    crop: {
        id: string;
        name: string;
        rent_price_6m: number;
        rent_price_1y: number;
        pricing_slabs?: PricingSlabConfig | null;
    };
}

function getInitialMode(crop: Props['crop']): PricingMode {
    if (!crop.pricing_slabs) return 'standard';
    return crop.pricing_slabs.mode === 'slabs' ? 'slabs' : 'minimum_monthly';
}

export function EditCropDialog({ crop }: Props) {
    const { refresh } = useStaticData();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    // Pricing mode state
    const [pricingMode, setPricingMode] = useState<PricingMode>(() => getInitialMode(crop));

    // Minimum + Monthly state
    const [minMonths, setMinMonths] = useState(crop.pricing_slabs?.min_months ?? 3);
    const [baseRate, setBaseRate] = useState(crop.pricing_slabs?.base_rate ?? 0);
    const [monthlyRate, setMonthlyRate] = useState(crop.pricing_slabs?.monthly_rate ?? 0);

    // Custom Slabs state
    const [slabs, setSlabs] = useState<PricingSlab[]>(
        crop.pricing_slabs?.slabs ?? [{ up_to_months: 6, rate_per_bag: 0 }]
    );
    const [slabsMinMonths, setSlabsMinMonths] = useState(crop.pricing_slabs?.min_months ?? 0);
    const [slabsMonthlyRate, setSlabsMonthlyRate] = useState(crop.pricing_slabs?.monthly_rate ?? 0);

    // Validation error for slabs
    const [slabError, setSlabError] = useState('');

    function addSlab() {
        const lastMonth = slabs.length > 0 ? slabs[slabs.length - 1]!.up_to_months : 0;
        setSlabs([...slabs, { up_to_months: lastMonth + 6, rate_per_bag: 0 }]);
    }

    function removeSlab(index: number) {
        if (slabs.length <= 1) return;
        setSlabs(slabs.filter((_, i) => i !== index));
    }

    function updateSlab(index: number, field: keyof PricingSlab, value: number) {
        setSlabs(prev => prev.map((slab, i) =>
            i === index ? { ...slab, [field]: value } : slab
        ));
    }

    function buildPricingSlabsConfig(): PricingSlabConfig | null {
        if (pricingMode === 'standard') return null;

        if (pricingMode === 'minimum_monthly') {
            return {
                mode: 'minimum_monthly',
                min_months: minMonths,
                base_rate: baseRate,
                monthly_rate: monthlyRate,
            };
        }

        // mode === 'slabs'
        return {
            mode: 'slabs',
            min_months: slabsMinMonths,
            slabs: slabs.map(s => ({ up_to_months: s.up_to_months, rate_per_bag: s.rate_per_bag })),
            monthly_rate: slabsMonthlyRate,
        };
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSlabError('');

        // Build and validate pricing config
        const config = buildPricingSlabsConfig();
        if (config) {
            const validationError = validatePricingSlabs(config);
            if (validationError) {
                setSlabError(validationError);
                setLoading(false);
                return;
            }
        }

        try {
            const formData = new FormData(e.currentTarget);
            // Add pricing_slabs as JSON string
            if (config) {
                formData.set('pricingSlabs', JSON.stringify(config));
            } else {
                formData.delete('pricingSlabs');
            }
            await updateCrop(crop.id, formData);
            setOpen(false);
            await refresh();
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Failed to update crop');
        }

        setLoading(false);
    }

    return (
        <Dialog open={open} onOpenChange={(v) => {
            setOpen(v);
            if (v) {
                // Reset state when opening
                setPricingMode(getInitialMode(crop));
                setMinMonths(crop.pricing_slabs?.min_months ?? 3);
                setBaseRate(crop.pricing_slabs?.base_rate ?? 0);
                setMonthlyRate(crop.pricing_slabs?.monthly_rate ?? 0);
                setSlabs(crop.pricing_slabs?.slabs ?? [{ up_to_months: 6, rate_per_bag: 0 }]);
                setSlabsMinMonths(crop.pricing_slabs?.min_months ?? 0);
                setSlabsMonthlyRate(crop.pricing_slabs?.monthly_rate ?? 0);
                setError('');
                setSlabError('');
            }
        }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Pencil className="h-4 w-4 text-blue-600" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Crop</DialogTitle>
                        <DialogDescription>
                            Update crop name and pricing configuration.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Crop Name *</Label>
                            <Input
                                id="name"
                                name="name"
                                defaultValue={crop.name}
                                required
                            />
                        </div>

                        {/* Pricing Mode Selector */}
                        <div className="grid gap-3">
                            <Label>Pricing Mode</Label>
                            <RadioGroup
                                value={pricingMode}
                                onValueChange={(v) => setPricingMode(v as PricingMode)}
                                className="grid gap-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="standard" id="mode-standard" />
                                    <Label htmlFor="mode-standard" className="font-normal cursor-pointer">
                                        Standard (6M / 1Y rates)
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="minimum_monthly" id="mode-minmonthly" />
                                    <Label htmlFor="mode-minmonthly" className="font-normal cursor-pointer">
                                        Minimum Period + Monthly
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="slabs" id="mode-slabs" />
                                    <Label htmlFor="mode-slabs" className="font-normal cursor-pointer">
                                        Custom Slabs
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {/* Standard: 6M / 1Y inputs */}
                        {pricingMode === 'standard' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="price6m">Rent (6M) *</Label>
                                    <Input
                                        id="price6m"
                                        name="price6m"
                                        type="number"
                                        step="0.01"
                                        defaultValue={crop.rent_price_6m}
                                        required
                                        min="0.01"
                                        onFocus={(e) => e.target.select()}
                                        onWheel={(e) => e.currentTarget.blur()}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="price1y">Rent (1Y) *</Label>
                                    <Input
                                        id="price1y"
                                        name="price1y"
                                        type="number"
                                        step="0.01"
                                        defaultValue={crop.rent_price_1y}
                                        required
                                        min="0.01"
                                        onFocus={(e) => e.target.select()}
                                        onWheel={(e) => e.currentTarget.blur()}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Hidden fields for 6m/1y when not in standard mode (keep DB values) */}
                        {pricingMode !== 'standard' && (
                            <>
                                <input type="hidden" name="price6m" value={crop.rent_price_6m} />
                                <input type="hidden" name="price1y" value={crop.rent_price_1y} />
                            </>
                        )}

                        {/* Minimum + Monthly mode */}
                        {pricingMode === 'minimum_monthly' && (
                            <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
                                <p className="text-xs text-muted-foreground">
                                    Charge a flat rate for the minimum period, then a per-month rate after.
                                </p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">Min Months *</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={minMonths}
                                            onChange={(e) => setMinMonths(parseInt(e.target.value) || 0)}
                                            onFocus={(e) => e.target.select()}
                                            onWheel={(e) => e.currentTarget.blur()}
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">Base Rate (₹/bag) *</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={baseRate}
                                            onChange={(e) => setBaseRate(parseFloat(e.target.value) || 0)}
                                            onFocus={(e) => e.target.select()}
                                            onWheel={(e) => e.currentTarget.blur()}
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">Monthly Rate (₹/bag) *</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={monthlyRate}
                                            onChange={(e) => setMonthlyRate(parseFloat(e.target.value) || 0)}
                                            onFocus={(e) => e.target.select()}
                                            onWheel={(e) => e.currentTarget.blur()}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground italic">
                                    Example: {minMonths}mo stored = ₹{baseRate}/bag. {minMonths + 3}mo = ₹{baseRate + 3 * monthlyRate}/bag.
                                </p>
                            </div>
                        )}

                        {/* Custom Slabs mode */}
                        {pricingMode === 'slabs' && (
                            <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
                                <p className="text-xs text-muted-foreground">
                                    Define tiered rates. Each slab covers storage up to the specified months.
                                </p>
                                <div className="grid gap-1.5">
                                    <Label className="text-xs">Minimum Storage Period (months)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={slabsMinMonths}
                                        onChange={(e) => setSlabsMinMonths(parseInt(e.target.value) || 0)}
                                        className="w-32"
                                        onFocus={(e) => e.target.select()}
                                        onWheel={(e) => e.currentTarget.blur()}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label className="text-xs">Billing Slabs</Label>
                                    {slabs.map((slab, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">Up to</span>
                                            <Input
                                                type="number"
                                                min="1"
                                                step="1"
                                                value={slab.up_to_months}
                                                onChange={(e) => updateSlab(i, 'up_to_months', parseInt(e.target.value) || 0)}
                                                className="w-20"
                                                onFocus={(e) => e.target.select()}
                                                onWheel={(e) => e.currentTarget.blur()}
                                            />
                                            <span className="text-xs text-muted-foreground">mo →</span>
                                            <span className="text-xs text-muted-foreground">₹</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={slab.rate_per_bag}
                                                onChange={(e) => updateSlab(i, 'rate_per_bag', parseFloat(e.target.value) || 0)}
                                                className="w-24"
                                                onFocus={(e) => e.target.select()}
                                                onWheel={(e) => e.currentTarget.blur()}
                                            />
                                            <span className="text-xs text-muted-foreground">/bag</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0"
                                                onClick={() => removeSlab(i)}
                                                disabled={slabs.length <= 1}
                                            >
                                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={addSlab} className="w-fit">
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Slab
                                    </Button>
                                </div>

                                <div className="grid gap-1.5">
                                    <Label className="text-xs">After last slab (₹/bag per month)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={slabsMonthlyRate}
                                        onChange={(e) => setSlabsMonthlyRate(parseFloat(e.target.value) || 0)}
                                        className="w-32"
                                        onFocus={(e) => e.target.select()}
                                        onWheel={(e) => e.currentTarget.blur()}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    {slabError && (
                        <p className="text-sm text-destructive mb-4">{slabError}</p>
                    )}
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
