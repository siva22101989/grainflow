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
import { useUnifiedToast } from '@/components/shared/toast-provider';
import { Loader2, Gift } from 'lucide-react';
import { redeemCodeAction } from '@/lib/subscription-code-actions';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';

interface RedeemCodeDialogProps {
  warehouseId: string;
  trigger?: React.ReactNode;
}

export function RedeemCodeDialog({ warehouseId, trigger }: RedeemCodeDialogProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { success, error } = useUnifiedToast();
  const router = useRouter();

  const handleRedeem = async () => {
    if (!warehouseId) {
        error("Error", "Warehouse information missing. Please refresh.");
        return;
    }

    if (!code || code.length < 5) {
        error("Invalid Code", "Please enter a valid activation code.");
        return;
    }

    setLoading(true);
    try {
        const result = await redeemCodeAction(code, warehouseId);
        success(
            "Subscription Activated!", 
            `You are now on the ${result.plan} plan until ${formatDate(result.endDate)}.`
        );
        setOpen(false);
        setCode('');
        router.refresh();
    } catch (err: any) {
        error("Redemption Failed", err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
                <Gift className="w-4 h-4" />
                Redeem Code
            </Button>
          </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redeem Activation Code</DialogTitle>
          <DialogDescription>
            Enter the code provided by your administrator to activate or extend your subscription.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="code">Activation Code</Label>
            <Input
              id="code"
              placeholder="e.g. PRO-365-XY9Z"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="uppercase font-mono tracking-widest text-center text-lg"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleRedeem} disabled={loading || !code}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Redeem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
