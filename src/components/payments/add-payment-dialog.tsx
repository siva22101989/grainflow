
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubmitButton } from "@/components/ui/submit-button";
import { addPayment } from '@/lib/actions/payments';
import { useServerAction } from '@/hooks/use-server-action';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { StorageRecord } from '@/lib/definitions';
import { formatCurrency } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

// Local SubmitButton removed in favor of shared component

import { usePreventNavigation } from '@/hooks/use-prevent-navigation';

export function AddPaymentDialog({ record, onClose, autoOpen = false }: { 
  record: StorageRecord & { balanceDue: number };
  onClose?: () => void;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [paymentType, setPaymentType] = useState<'rent' | 'hamali' | 'waiver'>('rent');
  
  const { runAction, isPending } = useServerAction();
  
  // Prevent navigation while pending
  usePreventNavigation(isPending);
  
  // Handlers for closing
  const handleClose = () => {
      setIsOpen(false);
      onClose?.();
  };
  
  const recordDisplay = record.recordNumber || `REC-${record.id.substring(0, 8)}`;
  const title = paymentType === 'hamali'
    ? 'Add Extra Hamali Charges'
    : paymentType === 'waiver'
      ? 'Apply Discount / Waiver'
      : 'Record Payment';
  const description = paymentType === 'hamali'
    ? `Add an additional hamali charge to ${recordDisplay}.`
    : paymentType === 'waiver'
      ? `Waive part of the balance for ${recordDisplay}. This reduces what's owed but is not counted as cash received. Balance Due: ${formatCurrency(record.balanceDue)}`
      : `Record a payment for ${recordDisplay}. Balance Due: ${formatCurrency(record.balanceDue)}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        // Prevent closing if processing
        if (isPending && !open) return;
        setIsOpen(open);
        if (!open) onClose?.();
    }}>
      {!autoOpen && (
        <DialogTrigger asChild>
          <Button size="sm">Add Payment</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => {
          if (isPending) e.preventDefault();
      }}>
        <form action={async (formData) => {
             await runAction(async () => {
                 const result = await addPayment({ message: '', success: false }, formData);
                 if (!result.success) {
                     throw new Error(result.message);
                 }
                 return result;
             }, {
                 successMessage: 'Payment recorded successfully',
                 onSuccess: () => {
                     handleClose();
                     router.refresh();
                 }
             });
        }}>
          <fieldset disabled={isPending} className="group">
              <input type="hidden" name="recordId" value={record.id} />
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                  {description}
                </DialogDescription>
              </DialogHeader>
              <div className={`grid gap-4 py-4 transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="grid gap-2">
                    <Label>Type</Label>
                    <RadioGroup 
                        defaultValue="rent"
                        name="paymentType"
                        className="flex gap-4"
                        value={paymentType}
                        onValueChange={(value: 'rent' | 'hamali' | 'waiver') => setPaymentType(value)}
                        disabled={isPending}
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="rent" id="r1" />
                            <Label htmlFor="r1">Rent/Other</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="hamali" id="r2" />
                            <Label htmlFor="r2">Hamali Charge</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="waiver" id="r3" />
                            <Label htmlFor="r3">Discount / Waiver</Label>
                        </div>
                    </RadioGroup>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentAmount">
                    {paymentType === 'waiver' ? 'Amount to Waive' : 'Amount'}
                  </Label>
                  <Input
                    id="paymentAmount"
                    name="paymentAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={paymentType === 'hamali' ? undefined : record.balanceDue}
                    placeholder={paymentType === 'hamali' ? "Enter amount" : `Max: ${formatCurrency(record.balanceDue)}`}
                    onFocus={(e) => e.target.select()}
                    onWheel={(e) => e.currentTarget.blur()}
                    required
                  />
                  {paymentType !== 'hamali' && (
                      <p className="text-xs text-muted-foreground mt-1">
                          {paymentType === 'waiver' ? 'Max waivable' : 'Max available'}: {formatCurrency(record.balanceDue)}
                      </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentDate">
                    Date
                  </Label>
                  <Input 
                    id="paymentDate" 
                    name="paymentDate" 
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    required 
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button" disabled={isPending}>Cancel</Button>
                </DialogClose>
                <SubmitButton isLoading={isPending}>Record Transaction</SubmitButton>
              </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
