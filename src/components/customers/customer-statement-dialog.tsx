'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Download, Loader2, FileText } from 'lucide-react';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { CustomerStatementReceipt } from './customer-statement-receipt';
import {
  generateCustomerStatementPdf,
  PRESET_TO_SECTIONS,
  type StatementPreset,
  type StatementSections,
} from '@/lib/customer-statement-pdf';
import { useWarehouses } from '@/contexts/warehouse-context';
import { DateRange } from 'react-day-picker';

interface Props {
  customer: Customer;
  records: StorageRecord[];
  dateRange?: DateRange;
}

export function CustomerStatementDialog({
  customer,
  records,
  dateRange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [preset, setPreset] = useState<StatementPreset | 'custom'>('complete');
  const [sections, setSections] = useState<StatementSections>(PRESET_TO_SECTIONS.complete);
  const { currentWarehouse } = useWarehouses();

  // When a preset is selected, snap the section checkboxes to match.
  const onPresetChange = (next: string) => {
    if (next === 'custom') {
      setPreset('custom');
      return;
    }
    const p = next as StatementPreset;
    setPreset(p);
    setSections(PRESET_TO_SECTIONS[p]);
  };

  // When user manually toggles a checkbox, flip the preset to 'custom'.
  const updateSection = (key: keyof StatementSections, value: boolean) => {
    setSections(prev => ({ ...prev, [key]: value }));
    setPreset('custom');
  };

  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    try {
      await generateCustomerStatementPdf({
        customer,
        records,
        sections,
        warehouse: currentWarehouse
          ? {
              name: currentWarehouse.name,
              location: currentWarehouse.location,
              gst_number: (currentWarehouse as any).gst_number,
            }
          : null,
        dateRange: dateRange?.from ? { from: dateRange.from, to: dateRange.to } : null,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Download Statement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[calc(100vw-1rem)] sm:w-full p-4 sm:p-6 max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customer Statement</DialogTitle>
        </DialogHeader>

        {/* Live preview — smaller on mobile so the selector + button stay reachable */}
        <div className="max-h-[35vh] sm:max-h-[55vh] overflow-y-auto overflow-x-auto p-2 border rounded-md bg-zinc-50/50">
          <CustomerStatementReceipt customer={customer} records={records} dateRange={dateRange} />
        </div>

        {/* Section selector */}
        <div className="border rounded-md p-3 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:items-end">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Statement Type</Label>
              <Select value={preset} onValueChange={onPresetChange}>
                <SelectTrigger className="h-10 sm:h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete">Complete (everything)</SelectItem>
                  <SelectItem value="summary">Summary only (totals box)</SelectItem>
                  <SelectItem value="records">Records breakdown (per-record dues)</SelectItem>
                  <SelectItem value="ledger">Chronological ledger (events + bulk grouping)</SelectItem>
                  <SelectItem value="custom">Custom (pick sections below)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Include sections</Label>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm py-1">
                  <Checkbox
                    checked={sections.includeRecordsTable}
                    onCheckedChange={(v) => updateSection('includeRecordsTable', !!v)}
                    className="h-5 w-5 sm:h-4 sm:w-4"
                  />
                  Records breakdown
                </label>
                <label className="flex items-center gap-2 text-sm py-1">
                  <Checkbox
                    checked={sections.includeLedger}
                    onCheckedChange={(v) => updateSection('includeLedger', !!v)}
                    className="h-5 w-5 sm:h-4 sm:w-4"
                  />
                  Transactions ledger
                </label>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Header, customer details, and totals box are always included. The PDF is text-based
            (small, searchable, crisp) and properly paginated.
          </p>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            onClick={handleDownloadPdf}
            disabled={isGenerating}
            className="w-full sm:w-auto h-11 sm:h-10"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating PDF…
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
