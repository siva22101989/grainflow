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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from 'lucide-react';
import { updateOutflow } from '@/lib/actions/storage/outflow';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface EditOutflowDialogProps {
    transaction: {
        id: string;
        bags: number;
        date: Date;
        rentCollected: number;
        maxEditableBags: number; // Current stock + bags withdrawn in this tx
    };
    children?: React.ReactNode; // optional custom trigger (e.g. a dropdown item)
}

export function EditOutflowDialog({ transaction, children }: EditOutflowDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [bags, setBags] = useState(transaction.bags);
  const [rent, setRent] = useState(transaction.rentCollected);
  const [date, setDate] = useState(
    transaction.date ? format(transaction.date, 'yyyy-MM-dd') : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (bags > transaction.maxEditableBags) {
        toast({
            title: "Error",
            description: `Cannot withdraw ${bags} bags. Max available is ${transaction.maxEditableBags}.`,
            variant: "destructive"
        });
        setIsLoading(false);
        return;
    }

    const formData = new FormData();
    formData.append('bags', bags.toString());
    formData.append('rent', rent.toString());
    formData.append('date', date);

    try {
        const result = await updateOutflow(transaction.id, formData);
        if (result.success) {
            toast({ title: "Updated", description: result.message });
            setOpen(false);
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Outflow</DialogTitle>
          <DialogDescription>
            Modify the withdrawal details. This will adjust the stock and calculated rent.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="date">
              Date
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bags">
              Bags
            </Label>
            <div>
                <Input
                id="bags"
                type="number"
                value={bags}
                onChange={(e) => setBags(parseInt(e.target.value) || 0)}
                required
                min={1}
                max={transaction.maxEditableBags}
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                />
                <p className="text-xs text-muted-foreground mt-1 text-primary/80 font-medium">
                    Max available: {transaction.maxEditableBags}
                </p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rent">
              Rent Bill
            </Label>
            <div>
                <Input
                id="rent"
                type="number"
                value={rent}
                onChange={(e) => setRent(parseFloat(e.target.value) || 0)}
                required
                min={0}
                step="0.01"
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                />
                <p className="text-xs text-muted-foreground mt-1 text-amber-600 font-medium">
                    Update manually if date/bags changed
                </p>
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
