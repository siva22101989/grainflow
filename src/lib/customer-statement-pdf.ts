/**
 * Native (text-based) PDF generator for the Customer Statement.
 *
 * Replaces the previous html2canvas → giant-PNG → 460-page-45MB approach
 * with proper jsPDF + autoTable rendering. Output is a small (~50KB),
 * searchable, crisp portrait A4 PDF that paginates correctly across N
 * records and N withdrawals.
 *
 * The caller picks which SECTIONS to include via StatementSections.
 * Header + totals box are always rendered. Records table and Transactions
 * Ledger are optional and independent.
 */

import type { Customer, StorageRecord } from './definitions';

const HEADER_FILL: [number, number, number] = [22, 78, 99];      // teal-900
const ZEBRA_FILL: [number, number, number] = [245, 247, 250];   // slate-50
const INFLOW_FILL: [number, number, number] = [232, 245, 233];  // green-50
const OUTFLOW_FILL: [number, number, number] = [255, 235, 238]; // red-50
const BATCH_FILL: [number, number, number] = [255, 243, 224];   // amber-100
const PAYMENT_FILL: [number, number, number] = [243, 229, 245]; // purple-50
const SLICE_TEXT: [number, number, number] = [110, 110, 110];   // grey

export type StatementSections = {
  includeRecordsTable: boolean;
  includeLedger: boolean;
};

export type StatementPreset = 'summary' | 'records' | 'ledger' | 'complete';

export const PRESET_TO_SECTIONS: Record<StatementPreset, StatementSections> = {
  summary: { includeRecordsTable: false, includeLedger: false },
  records: { includeRecordsTable: true, includeLedger: false },
  ledger: { includeRecordsTable: false, includeLedger: true },
  complete: { includeRecordsTable: true, includeLedger: true },
};

function fmtINR(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '-';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function loadPdf() {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = (autoTableMod as any).default ?? autoTableMod;
  return { jsPDF, autoTable };
}

type LedgerRow = {
  date: Date;
  kind: 'inflow' | 'outflow' | 'payment';
  description: string;
  invoiceNo: string;
  bagsIn?: number;
  bagsOut?: number;
  rent?: number;
  hamali?: number;
  insurance?: number;
  credit?: number;
  isBulkBatch?: boolean;
  slices?: { recordNumber?: string | null; bagsOut: number; rent: number }[];
};

/**
 * Derive the chronological ledger from records (same logic as
 * customer-statement-receipt.tsx, kept here so the PDF doesn't depend on
 * the React component).
 */
function buildLedger(records: StorageRecord[]): (LedgerRow & { balance: number })[] {
  const out: LedgerRow[] = [];

  records.forEach(r => {
    out.push({
      date: r.storageStartDate instanceof Date ? r.storageStartDate : new Date(r.storageStartDate),
      kind: 'inflow',
      description: `Inflow - ${r.commodityDescription || 'Storage'}`,
      invoiceNo: r.recordNumber || r.id.substring(0, 8),
      bagsIn: r.bagsIn,
      hamali: r.hamaliPayable || 0,
      insurance: (r as any).insurancePayable || 0,
    });
    (r.payments || []).forEach(p => {
      out.push({
        date: p.date instanceof Date ? p.date : new Date(p.date),
        kind: 'payment',
        description: `Payment - ${p.type || 'general'}`,
        invoiceNo: r.recordNumber || r.id.substring(0, 8),
        credit: p.amount,
      });
    });
  });

  type WT = { record: StorageRecord; w: NonNullable<StorageRecord['withdrawals']>[number] };
  const allWds: WT[] = [];
  records.forEach(r => (r.withdrawals || []).forEach(w => allWds.push({ record: r, w })));

  const batches = new Map<string, WT[]>();
  const singletons: WT[] = [];
  for (const wt of allWds) {
    const key = wt.w.consolidatedInvoiceNo;
    if (!key) singletons.push(wt);
    else {
      const list = batches.get(key) || [];
      list.push(wt);
      batches.set(key, list);
    }
  }

  for (const [invoiceNo, slices] of batches.entries()) {
    const totalBags = slices.reduce((s, sl) => s + sl.w.bagsWithdrawn, 0);
    const totalRent = slices.reduce((s, sl) => s + sl.w.rentCollected, 0);
    const earliest = slices.reduce(
      (m, sl) => Math.min(m, (sl.w.date instanceof Date ? sl.w.date : new Date(sl.w.date)).getTime()),
      Infinity
    );
    out.push({
      date: new Date(earliest),
      kind: 'outflow',
      description: `Bulk Outflow - ${slices.length} records, ${totalBags} bags`,
      invoiceNo,
      bagsOut: totalBags,
      rent: totalRent,
      isBulkBatch: true,
      slices: slices.map(sl => ({
        recordNumber: sl.record.recordNumber,
        bagsOut: sl.w.bagsWithdrawn,
        rent: sl.w.rentCollected,
      })),
    });
  }

  for (const { record, w } of singletons) {
    out.push({
      date: w.date instanceof Date ? w.date : new Date(w.date),
      kind: 'outflow',
      description: 'Outflow',
      invoiceNo: record.recordNumber || record.id.substring(0, 8),
      bagsOut: w.bagsWithdrawn,
      rent: w.rentCollected,
    });
  }

  out.sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0;
  return out.map(r => {
    running += (r.hamali || 0) + (r.insurance || 0) + (r.rent || 0) - (r.credit || 0);
    return { ...r, balance: running };
  });
}

export async function generateCustomerStatementPdf(opts: {
  customer: Customer;
  records: StorageRecord[];
  sections: StatementSections;
  warehouse?: { name?: string; location?: string; phone?: string; gst_number?: string } | null;
  dateRange?: { from?: Date; to?: Date } | null;
}): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // ---- Header ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text((opts.warehouse?.name || 'WAREHOUSE').toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const headerLines: string[] = [];
  if (opts.warehouse?.location) headerLines.push(opts.warehouse.location);
  if (opts.warehouse?.phone) headerLines.push(`Phone: ${opts.warehouse.phone}`);
  if (opts.warehouse?.gst_number) headerLines.push(`GST: ${opts.warehouse.gst_number}`);
  headerLines.forEach(line => {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += 4;
  });
  y += 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('CUSTOMER STATEMENT', pageWidth / 2, y, { align: 'center' });
  y += 6;

  // ---- Customer details box ----
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const customerLines: string[] = [
    `Name: ${opts.customer.name}`,
    opts.customer.fatherName ? `S/o: ${opts.customer.fatherName}` : '',
    opts.customer.village ? `Village: ${opts.customer.village}` : (opts.customer.address || ''),
    opts.customer.phone ? `Phone: ${opts.customer.phone}` : '',
    opts.customer.customerNumber != null ? `Customer ID: ${opts.customer.customerNumber}` : '',
  ].filter(Boolean);

  const rightLines: string[] = [
    `Statement Date: ${fmtDate(new Date())}`,
    `Total Records: ${opts.records.length}`,
  ];
  if (opts.dateRange?.from) {
    rightLines.push(`Period: ${fmtDate(opts.dateRange.from)} - ${opts.dateRange.to ? fmtDate(opts.dateRange.to) : '...'}`);
  }

  const boxTop = y;
  const boxHeight = Math.max(customerLines.length, rightLines.length) * 4.5 + 4;
  doc.setDrawColor(220);
  doc.roundedRect(10, boxTop, pageWidth - 20, boxHeight, 2, 2);
  customerLines.forEach((line, i) => doc.text(line, 13, boxTop + 5 + i * 4.5));
  rightLines.forEach((line, i) => doc.text(line, pageWidth - 13, boxTop + 5 + i * 4.5, { align: 'right' }));
  y = boxTop + boxHeight + 6;

  // ---- Totals summary ----
  let totalRent = 0, totalHamali = 0, totalInsurance = 0, totalPaid = 0;
  opts.records.forEach(r => {
    totalRent += r.totalRentBilled || 0;
    totalHamali += r.hamaliPayable || 0;
    totalInsurance += (r as any).insurancePayable || 0;
    totalPaid += (r.payments || []).reduce((s, p) => s + p.amount, 0);
  });
  const totalBilled = totalRent + totalHamali + totalInsurance;
  const balanceDue = totalBilled - totalPaid;

  autoTable(doc, {
    startY: y,
    head: [['Total Rent', 'Total Hamali', 'Total Insurance', 'Total Paid', 'Balance Due']],
    body: [[
      `₹${fmtINR(totalRent)}`,
      `₹${fmtINR(totalHamali)}`,
      `₹${fmtINR(totalInsurance)}`,
      `₹${fmtINR(totalPaid)}`,
      `₹${fmtINR(balanceDue)}`,
    ]],
    theme: 'grid',
    headStyles: { fillColor: HEADER_FILL, fontStyle: 'bold', fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 11, fontStyle: 'bold', halign: 'center', cellPadding: 3 },
    columnStyles: { 4: { textColor: balanceDue > 0 ? [200, 35, 35] : [40, 130, 60] } },
    margin: { left: 10, right: 10 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ---- Optional: Records Summary table ----
  if (opts.sections.includeRecordsTable) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Detailed Stock Register', 10, y);
    y += 3;

    autoTable(doc, {
      startY: y + 2,
      head: [['Record #', 'Date In', 'Commodity', 'Bags', 'Billed', 'Paid', 'Balance']],
      body: opts.records.map(r => {
        const billed = (r.totalRentBilled || 0) + (r.hamaliPayable || 0) + ((r as any).insurancePayable || 0);
        const paid = (r.payments || []).reduce((s, p) => s + p.amount, 0);
        const bal = billed - paid;
        return [
          r.recordNumber || r.id.substring(0, 8),
          fmtDate(r.storageStartDate),
          r.commodityDescription || '-',
          r.bagsStored,
          `₹${fmtINR(billed)}`,
          `₹${fmtINR(paid)}`,
          { content: `₹${fmtINR(bal)}`, styles: { textColor: bal > 0 ? [200, 35, 35] : [40, 130, 60], fontStyle: 'bold' } },
        ] as any;
      }),
      foot: [[
        { content: 'Totals', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `₹${fmtINR(totalBilled)}`, styles: { fontStyle: 'bold' } },
        { content: `₹${fmtINR(totalPaid)}`, styles: { fontStyle: 'bold' } },
        { content: `₹${fmtINR(balanceDue)}`, styles: { fontStyle: 'bold', textColor: balanceDue > 0 ? [200, 35, 35] : [40, 130, 60] } },
      ]],
      theme: 'striped',
      headStyles: { fillColor: HEADER_FILL, fontSize: 9, halign: 'center' },
      bodyStyles: { fontSize: 8.5 },
      footStyles: { fillColor: ZEBRA_FILL, textColor: [0, 0, 0] },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ---- Optional: Transactions Ledger ----
  if (opts.sections.includeLedger) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Transactions Ledger', 10, y);
    y += 1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text('Chronological events. Bulk outflows show as one bill row with the affected records listed beneath.', 10, y + 4);
    doc.setTextColor(0);
    y += 7;

    const ledger = buildLedger(opts.records);

    const body: any[] = [];
    ledger.forEach(e => {
      const tint =
        e.isBulkBatch ? BATCH_FILL :
        e.kind === 'inflow' ? INFLOW_FILL :
        e.kind === 'outflow' ? OUTFLOW_FILL :
        e.kind === 'payment' ? PAYMENT_FILL : undefined;

      body.push([
        { content: fmtDate(e.date), styles: tint ? { fillColor: tint, fontStyle: e.isBulkBatch ? 'bold' : 'normal' } : {} },
        { content: e.description, styles: tint ? { fillColor: tint, fontStyle: e.isBulkBatch ? 'bold' : 'normal' } : {} },
        { content: e.invoiceNo, styles: tint ? { fillColor: tint, fontStyle: 'bold' } : { fontStyle: 'bold' } },
        { content: e.bagsIn ?? '', styles: { halign: 'right', ...(tint ? { fillColor: tint } : {}) } },
        { content: e.bagsOut ?? '', styles: { halign: 'right', ...(tint ? { fillColor: tint } : {}) } },
        { content: e.rent != null ? `₹${fmtINR(e.rent)}` : '', styles: { halign: 'right', ...(tint ? { fillColor: tint } : {}) } },
        { content: e.credit != null ? `₹${fmtINR(e.credit)}` : '', styles: { halign: 'right', textColor: [40, 130, 60], ...(tint ? { fillColor: tint } : {}) } },
        { content: `₹${fmtINR(e.balance)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: e.balance > 0 ? [200, 35, 35] : [40, 130, 60], ...(tint ? { fillColor: tint } : {}) } },
      ]);

      // Bulk batch detail rows
      if (e.isBulkBatch && e.slices) {
        e.slices.forEach(sl => {
          body.push([
            { content: '', styles: { fillColor: [253, 250, 240] } },
            { content: `    ↳ Record #${sl.recordNumber ?? '-'}`, styles: { textColor: SLICE_TEXT, fontStyle: 'italic', fillColor: [253, 250, 240] } },
            { content: '', styles: { fillColor: [253, 250, 240] } },
            { content: '', styles: { fillColor: [253, 250, 240] } },
            { content: sl.bagsOut, styles: { halign: 'right', textColor: SLICE_TEXT, fillColor: [253, 250, 240] } },
            { content: `₹${fmtINR(sl.rent)}`, styles: { halign: 'right', textColor: SLICE_TEXT, fillColor: [253, 250, 240] } },
            { content: '', styles: { fillColor: [253, 250, 240] } },
            { content: '', styles: { fillColor: [253, 250, 240] } },
          ]);
        });
      }
    });

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Description', 'Bill / Record #', 'Bags In', 'Bags Out', 'Rent', 'Paid', 'Balance']],
      body,
      theme: 'grid',
      headStyles: { fillColor: HEADER_FILL, fontSize: 8.5, halign: 'center' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 22 },
        2: { cellWidth: 28 },
        3: { halign: 'right', cellWidth: 14 },
        4: { halign: 'right', cellWidth: 14 },
        5: { halign: 'right', cellWidth: 22 },
        6: { halign: 'right', cellWidth: 22 },
        7: { halign: 'right', cellWidth: 24 },
      },
      margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ---- Footer on every page ----
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 10, 290, { align: 'right' });
    doc.text(`${opts.customer.name}  |  Generated ${fmtDate(new Date())}  |  Computer-generated statement`, 10, 290);
    doc.setTextColor(0);
  }

  const safeName = opts.customer.name.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  doc.save(`statement-${safeName}-${new Date().toISOString().split('T')[0]}.pdf`);
}
