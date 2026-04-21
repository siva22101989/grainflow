'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addCrop } from '@/lib/admin-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IndianRupee, Loader2, Plus } from 'lucide-react';
import { useStaticData } from '@/hooks/use-static-data';
import { useToast } from '@/hooks/use-toast';

// Simplified state since admin-actions might not return structured state yet
// But based on other files, actions might just throw or return void/undefined if successful
// Let's assume we need to handle basic form submission. Note: admin-actions.ts addCrop is void return.
// We should update admin-actions to return state if we want to track success reliably, 
// OR we can wrap it. For now, let's keep it simple and assume standard Next.js form handling
// But wait, the standard form action doesn't give us a callback on client unless we use useActionState (next 15/canary) or similar.
// Actually, looking at admin-actions.ts, addCrop returns Promise<void> and throws on error.
// To use it with useActionState, we need a wrapper.

async function addCropWrapper(_prevState: any, formData: FormData) {
    try {
        await addCrop(formData);
        return { success: true, message: 'Crop added successfully' };
    } catch (e: any) {
        return { success: false, message: e.message || 'Failed to add crop' };
    }
}

const initialState = { success: false, message: '' };

export function AddCropForm() {
    const [state, formAction, isPending] = useActionState(addCropWrapper, initialState);
    const { refresh } = useStaticData();
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const lastHandledRef = useRef<any>(null);

    useEffect(() => {
        if (state.message && state !== lastHandledRef.current) {
            lastHandledRef.current = state;
            if (state.success) {
                toast({ title: 'Success', description: state.message });
                refresh();
                formRef.current?.reset();
            } else {
                toast({ title: 'Error', description: state.message, variant: 'destructive' });
            }
        }
    }, [state, refresh, toast]);

    return (
        <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-6 items-end bg-muted/20 p-4 rounded-lg border border-dashed">
            <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="crop-name">Name</Label>
                <Input id="crop-name" name="name" placeholder="e.g. Paddy" required className="bg-background" />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="price6m">Rent (6M)</Label>
                <div className="relative">
                    <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="price6m" name="price6m" type="number" step="0.01" placeholder="30" required className="pl-9 bg-background" onFocus={(e) => e.target.select()} onWheel={(e) => e.currentTarget.blur()} />
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="price1y">Rent (1Y)</Label>
                <div className="relative">
                    <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="price1y" name="price1y" type="number" step="0.01" placeholder="50" required className="pl-9 bg-background" onFocus={(e) => e.target.select()} onWheel={(e) => e.currentTarget.blur()} />
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="insurancePerBag">Insurance (/bag)</Label>
                <div className="relative">
                    <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="insurancePerBag" name="insurancePerBag" type="number" step="0.01" min="0" placeholder="0" defaultValue="0" className="pl-9 bg-background" onFocus={(e) => e.target.select()} onWheel={(e) => e.currentTarget.blur()} />
                </div>
            </div>
            <div className="md:col-span-6 md:col-start-6">
                <Button type="submit" disabled={isPending} className="w-full md:w-auto">
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Add Crop
                </Button>
            </div>
        </form>
    );
}
