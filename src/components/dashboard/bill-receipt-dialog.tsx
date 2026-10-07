
'use client';

import { useRef, useState } from 'react';
// import jsPDF from 'jspdf'; // Removed for lazy loading
// import html2canvas from 'html2canvas'; // Removed for lazy loading
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Download, Loader2 } from 'lucide-react';
import { BillReceipt } from './bill-receipt';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { logError } from '@/lib/error-logger';

export function BillReceiptDialog({
  record,
  customer,
  children,
}: {
  record: StorageRecord;
  customer: Customer;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  // We use a separate ref for the hidden, print-optimized version
  const printRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = async () => {
    const element = printRef.current;
    if (!element) return;

    setIsGenerating(true);

    try {
      const [html2canvas, { default: jsPDF }] = await Promise.all([
        import('html2canvas').then(m => m.default),
        import('jspdf')
      ]);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;
      let widthInPdf = pdfWidth - 20;
      let heightInPdf = widthInPdf / ratio;

      if (heightInPdf > pdfHeight - 20) {
        heightInPdf = pdfHeight - 20;
        widthInPdf = heightInPdf * ratio;
      }

      const x = (pdfWidth - widthInPdf) / 2;
      const y = 10;

      pdf.addImage(imgData, 'PNG', x, y, widthInPdf, heightInPdf);
      pdf.save(`bill-${record.id}.pdf`);
    } catch (error) {
      logError(error, { operation: 'billReceipt.generatePdf' });
    } finally {
      setIsGenerating(false);
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Billing Statement</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto p-2">
            <BillReceipt record={record} customer={customer} />
        </div>
        
        {/* Hidden Print Version - Optimizes PDF generation */}
        <div style={{ position: 'fixed', top: '-1000vh', left: '-1000vw', width: '210mm' }}>
             <BillReceipt ref={printRef} record={record} customer={customer} />
        </div>
        <DialogFooter className="sm:justify-end">
          <Button onClick={handleDownloadPdf} disabled={isGenerating}>
            {isGenerating ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downloading...
                </>
            ) : (
                <>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
