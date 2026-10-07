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
import { Textarea } from '@/components/ui/textarea';
import { createAndSendPaymentLink } from '@/lib/actions/razorpay-actions';
import { Loader2, Link as LinkIcon, Send, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { logError } from '@/lib/error-logger';

interface PaymentLinkDialogProps {
  customerId: string;
  customerName: string;
  defaultAmount?: number;
  recordId?: string;
}

export function PaymentLinkDialog({
  customerId,
  customerName,
  defaultAmount = 0,
  recordId,
}: PaymentLinkDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(defaultAmount.toString());
  const [description, setDescription] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);

    try {
      const desc = description || `Payment for ${customerName}`;
      const result = await createAndSendPaymentLink(customerId, amountNum, desc, recordId);

      if (result.success && result.shortUrl) {
        setGeneratedLink(result.shortUrl);
        
        if (result.smsStatus) {
          toast.success('Payment link created and SMS sent successfully!');
        } else {
          toast.warning('Payment link created but SMS failed. Copy link manually.');
        }
      } else {
        toast.error(result.error || 'Failed to create payment link');
      }
    } catch (error) {
      toast.error('Failed to create payment link');
      logError(error, { operation: 'paymentLinkDialog' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset form after closing
    setTimeout(() => {
      setAmount(defaultAmount.toString());
      setDescription('');
      setGeneratedLink(null);
      setCopied(false);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      setOpen(isOpen);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LinkIcon className="mr-2 h-4 w-4" />
          Send Payment Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Payment Link</DialogTitle>
          <DialogDescription>
            Create a secure payment link and send it to {customerName} via SMS
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Payment for ${customerName}`}
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Preview SMS:</p>
              <p className="text-muted-foreground">
                Dear {customerName},<br />
                Pending dues: ₹{amount || '0'}<br />
                Pay online: [Payment Link]<br />
                - GrainFlow Warehouse
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Create & Send
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-950 p-4 text-center">
              <Check className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-2" />
              <p className="font-semibold text-green-900 dark:text-green-100">
                Payment Link Created!
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                SMS sent to customer
              </p>
            </div>

            <div className="space-y-2">
              <Label>Payment Link</Label>
              <div className="flex gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Link expires in 7 days
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
