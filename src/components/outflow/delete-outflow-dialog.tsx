'use client';

import { useState, useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { deleteOutflow } from '@/lib/actions/storage/outflow';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function DeleteOutflowDialog({
  transactionId,
  bags,
  children,
}: {
  transactionId: string;
  bags: number;
  children: React.ReactNode;
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = async () => {
    startTransition(async () => {
      const result = await deleteOutflow(transactionId);
      if (result.success) {
        setIsOpen(false);
        toast({
          title: 'Outflow Reversed',
          description: `${bags} bags restored to storage. Rent charges reversed.`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reverse this outflow?</AlertDialogTitle>
          <AlertDialogDescription>
            This will restore {bags} bags back to storage and reverse the rent charges.
            This action is for correcting mistakes only.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reverse Outflow
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
