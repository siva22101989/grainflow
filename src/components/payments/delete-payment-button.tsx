'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { deletePayment } from '@/lib/actions/payments';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

interface Props {
    paymentId: string;
    customerId: string;
    amount: number;
    variant?: 'default' | 'outline' | 'ghost' | 'destructive';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function DeletePaymentButton({ paymentId, customerId, amount, variant = 'ghost', size = 'icon' }: Props) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    async function handleDelete() {
        setLoading(true);
        setError('');
        try {
            const result = await deletePayment(paymentId, customerId);
            if (result.success) {
                setOpen(false);       // close the dialog on success
                router.refresh();     // drop the row from the list
            } else {
                setError(result.message);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to delete payment');
        } finally {
            setLoading(false);        // never leave the button stuck on "Deleting…"
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={(o) => { if (!loading) setOpen(o); }}>
            <AlertDialogTrigger asChild>
                <Button variant={variant} size={size}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the payment of <strong>{formatCurrency(amount)}</strong>.
                        This action cannot be undone and will affect the customer's balance.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => { e.preventDefault(); handleDelete(); }}
                        disabled={loading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {loading ? 'Deleting...' : 'Delete Payment'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
