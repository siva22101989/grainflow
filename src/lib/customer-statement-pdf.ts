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
import { ensurePdfFonts } from './pdf-fonts';

const HEADER_FILL: [number, number, number] = [22, 78, 99];      // teal-900
const ZEBRA_FILL: [number, number, number] = [245, 247, 250];   // slate-50
const INFLOW_FILL: [number, number, number] = [232, 245, 233];  // green-50
const OUTFLOW_FILL: [number, number, number] = [255, 235, 238]; // red-50
const BATCH_FILL: [number, number, number] = [255, 243, 224];   // amber-100
const PAYMENT_FILL: [number, number, number] = [243, 229, 245]; // purple-50
const SLICE_TEXT: [number, number, number] = [110, 110, 110];   // grey

// Inter is embedded via ensurePdfFonts. We name the font 'Inter' throughout.
// If the font load fails (offline / 404), we fall back to helvetica.
const BODY_FONT = 'Inter';
const FALLBACK_FONT = 'helvetica';

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

  // Try to embed Inter TTF. If it fails (offline / asset missing), fall
  // back to helvetica so the PDF still generates.
  let font = BODY_FONT;
  try {
    await ensurePdfFonts(doc);
  } catch {
    font = FALLBACK_FONT;
  }

  // ---- Header ----
  doc.setFont(font, 'bold');
  doc.setFontSize(18);
  doc.text((opts.warehouse?.name || 'WAREHOUSE').toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 7;
  doc.setFont(font, 'normal');
  doc.setFontSize(9.5);
  const headerLines: string[] = [];
  if (opts.warehouse?.location) headerLines.push(opts.warehouse.location);
  if (opts.warehouse?.phone) headerLines.push(`Phone: ${opts.warehouse.phone}`);
  if (opts.warehouse?.gst_number) headerLines.push(`GST: ${opts.warehouse.gst_number}`);
  headerLines.forEach(line => {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += 4.5;
  });
  y += 2;
  // Subtle divider line under the warehouse header
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(10, y, pageWidth - 10, y);
  y += 5;
  doc.setFont(font, 'bold');
  doc.setFontSize(13);
  doc.text('CUSTOMER STATEMENT', pageWidth / 2, y, { align: 'center' });
  y += 7;

  // ---- Customer details box ----
  doc.setFontSize(9.5);
  doc.setFont(font, 'normal');
  const customerLines: { label: string; value: string }[] = [
    { label: 'Name', value: opts.customer.name },
    ...(opts.customer.fatherName ? [{ label: 'S/o', value: opts.customer.fatherName }] : []),
    { label: 'Village', value: opts.customer.village || opts.customer.address || '-' },
    ...(opts.customer.phone ? [{ label: 'Phone', value: opts.customer.phone }] : []),
    ...(opts.customer.customerNumber != null ? [{ label: 'Customer ID', value: String(opts.customer.customerNumber) }] : []),
  ];

  const rightLines: { label: string; value: string }[] = [
    { label: 'Statement Date', value: fmtDate(new Date()) },
    { label: 'Total Records', value: String(opts.records.length) },
  ];
  if (opts.dateRange?.from) {
    rightLines.push({
      label: 'Period',
      value: `${fmtDate(opts.dateRange.from)} - ${opts.dateRange.to ? fmtDate(opts.dateRange.to) : '...'}`,
    });
  }

  const boxTop = y;
  const lineHeight = 5;
  const boxHeight = Math.max(customerLines.length, rightLines.length) * lineHeight + 5;
  doc.setDrawColor(200);
  doc.setFillColor(250, 250, 252);
  doc.roundedRect(10, boxTop, pageWidth - 20, boxHeight, 2, 2, 'FD');

  customerLines.forEach(({ label, value }, i) => {
    doc.setFont(font, 'normal');
    doc.setTextColor(110);
    doc.text(`${label}:`, 14, boxTop + 6 + i * lineHeight);
    doc.setFont(font, 'bold');
    doc.setTextColor(20);
    doc.text(value, 38, boxTop + 6 + i * lineHeight);
  });
  // Right column: label anchored further left + value right-aligned at the
  // box edge. The previous offset (pageWidth - 52) gave the label ~38mm
  // before the value, which wasn't enough for "Statement Date:" — the
  // value overlapped the last few characters of the label. Bumped to 75mm.
  rightLines.forEach(({ label, value }, i) => {
    doc.setFont(font, 'normal');
    doc.setTextColor(110);
    doc.text(`${label}:`, pageWidth - 75, boxTop + 6 + i * lineHeight);
    doc.setFont(font, 'bold');
    doc.setTextColor(20);
    doc.text(value, pageWidth - 14, boxTop + 6 + i * lineHeight, { align: 'right' });
  });
  doc.setTextColor(0);
  y = boxTop + boxHeight + 7;

  // ---- Totals summary (bags + money, two strips) ----
  let totalRent = 0, totalHamali = 0, totalInsurance = 0, totalPaid = 0;
  let totalBagsIn = 0, totalBagsOut = 0, balanceStock = 0;
  opts.records.forEach(r => {
    totalRent += r.totalRentBilled || 0;
    totalHamali += r.hamaliPayable || 0;
    totalInsurance += (r as any).insurancePayable || 0;
    totalPaid += (r.payments || []).reduce((s, p) => s + p.amount, 0);
    totalBagsIn += r.bagsIn || 0;
    totalBagsOut += r.bagsOut || 0;
    balanceStock += r.bagsStored || 0;
  });
  const totalBilled = totalRent + totalHamali + totalInsurance;
  const balanceDue = totalBilled - totalPaid;

  // Strip 1: Bag totals (In / Out / Stock) — restored from the legacy
  // statement; useful for the customer to see physical movement at a glance.
  autoTable(doc, {
    startY: y,
    head: [['Total Bags In', 'Total Bags Out', 'Balance Stock']],
    body: [[
      totalBagsIn.toLocaleString('en-IN'),
      totalBagsOut.toLocaleString('en-IN'),
      balanceStock.toLocaleString('en-IN'),
    ]],
    theme: 'grid',
    headStyles: { fillColor: HEADER_FILL, fontStyle: 'bold', fontSize: 9, halign: 'center', font, textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 12, fontStyle: 'bold', halign: 'center', cellPadding: 4, font },
    margin: { left: 10, right: 10 },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // Strip 2: Money totals (Rent / Hamali / Insurance / Paid / Balance Due)
  autoTable(doc, {
    startY: y,
    head: [['Total Rent (₹)', 'Total Hamali (₹)', 'Total Insurance (₹)', 'Total Paid (₹)', 'Balance Due (₹)']],
    body: [[
      fmtINR(totalRent),
      fmtINR(totalHamali),
      fmtINR(totalInsurance),
      fmtINR(totalPaid),
      fmtINR(balanceDue),
    ]],
    theme: 'grid',
    headStyles: { fillColor: HEADER_FILL, fontStyle: 'bold', fontSize: 9, halign: 'center', font, textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 12, fontStyle: 'bold', halign: 'center', cellPadding: 4, font },
    columnStyles: { 4: { textColor: balanceDue > 0 ? [200, 35, 35] : [40, 130, 60] } },
    margin: { left: 10, right: 10 },
  });
  y = (doc as any).lastAutoTable.finalY + 9;

  // ---- Optional: Records Summary table ----
  if (opts.sections.includeRecordsTable) {
    doc.setFont(font, 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(40);
    doc.text('Detailed Stock Register', 10, y);
    doc.setTextColor(0);
    y += 3;

    // Page width minus left+right margin (10+10) = 190mm usable.
    // Distribute deliberately so amounts (which can be 5-7 digits with
    // commas like 1,00,000) have room without truncating.
    autoTable(doc, {
      startY: y + 2,
      head: [['Rec #', 'Date In', 'Commodity', 'Bags', 'Billed (₹)', 'Paid (₹)', 'Balance (₹)']],
      body: opts.records.map(r => {
        const billed = (r.totalRentBilled || 0) + (r.hamaliPayable || 0) + ((r as any).insurancePayable || 0);
        const paid = (r.payments || []).reduce((s, p) => s + p.amount, 0);
        const bal = billed - paid;
        return [
          { content: r.recordNumber || r.id.substring(0, 8), styles: { fontStyle: 'bold' } },
          fmtDate(r.storageStartDate),
          r.commodityDescription || '-',
          { content: r.bagsStored, styles: { halign: 'right' } },
          { content: fmtINR(billed), styles: { halign: 'right' } },
          { content: fmtINR(paid), styles: { halign: 'right' } },
          { content: fmtINR(bal), styles: { halign: 'right', fontStyle: 'bold', textColor: bal > 0 ? [200, 35, 35] : [40, 130, 60] } },
        ] as any;
      }),
      foot: [[
        { content: 'Totals', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: fmtINR(totalBilled), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: fmtINR(totalPaid), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: fmtINR(balanceDue), styles: { fontStyle: 'bold', halign: 'right', textColor: balanceDue > 0 ? [200, 35, 35] : [40, 130, 60] } },
      ]],
      theme: 'striped',
      headStyles: { fillColor: HEADER_FILL, fontSize: 9.5, halign: 'center', font, textColor: [255, 255, 255] },
      bodyStyles: { fontSize: 9, cellPadding: 2.5, font },
      footStyles: { fillColor: ZEBRA_FILL, textColor: [0, 0, 0], fontSize: 9.5, font },
      columnStyles: {
        0: { cellWidth: 18, halign: 'left' },   // Rec #
        1: { cellWidth: 22, halign: 'left' },   // Date In
        2: { cellWidth: 30, halign: 'left' },   // Commodity
        3: { cellWidth: 16, halign: 'right' },  // Bags
        4: { cellWidth: 32, halign: 'right' },  // Billed
        5: { cellWidth: 32, halign: 'right' },  // Paid
        6: { cellWidth: 40, halign: 'right' },  // Balance — generous
      },
      margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 9;
  }

  // ---- Optional: Transactions Ledger ----
  if (opts.sections.includeLedger) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFont(font, 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(40);
    doc.text('Transactions Ledger', 10, y);
    doc.setTextColor(0);
    y += 1;
    doc.setFont(font, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(110);
    doc.text('Chronological events. Bulk outflows show as one bill row with the affected records listed beneath.', 10, y + 4.5);
    doc.setTextColor(0);
    y += 8;

    const ledger = buildLedger(opts.records);

    const body: any[] = [];
    ledger.forEach(e => {
      const tint =
        e.isBulkBatch ? BATCH_FILL :
        e.kind === 'inflow' ? INFLOW_FILL :
        e.kind === 'outflow' ? OUTFLOW_FILL :
        e.kind === 'payment' ? PAYMENT_FILL : undefined;

      const rowStyle: any = tint ? { fillColor: tint } : {};
      body.push([
        { content: fmtDate(e.date), styles: { ...rowStyle, fontStyle: e.isBulkBatch ? 'bold' : 'normal' } },
        { content: e.description, styles: { ...rowStyle, fontStyle: e.isBulkBatch ? 'bold' : 'normal' } },
        { content: e.invoiceNo, styles: { ...rowStyle, fontStyle: 'bold' } },
        { content: e.bagsIn ?? '', styles: { ...rowStyle, halign: 'right' } },
        { content: e.bagsOut ?? '', styles: { ...rowStyle, halign: 'right' } },
        { content: e.rent != null ? fmtINR(e.rent) : '', styles: { ...rowStyle, halign: 'right' } },
        { content: e.credit != null ? fmtINR(e.credit) : '', styles: { ...rowStyle, halign: 'right', textColor: [40, 130, 60] } },
        { content: fmtINR(e.balance), styles: { ...rowStyle, halign: 'right', fontStyle: 'bold', textColor: e.balance > 0 ? [200, 35, 35] : [40, 130, 60] } },
      ]);

      // Bulk batch detail rows — soft amber tint, italic, indented
      if (e.isBulkBatch && e.slices) {
        e.slices.forEach(sl => {
          const sliceStyle = { fillColor: [253, 250, 240] as [number, number, number] };
          body.push([
            { content: '', styles: sliceStyle },
            { content: `    Record #${sl.recordNumber ?? '-'}`, styles: { ...sliceStyle, textColor: SLICE_TEXT, fontStyle: 'italic' } },
            { content: '', styles: sliceStyle },
            { content: '', styles: sliceStyle },
            { content: sl.bagsOut, styles: { ...sliceStyle, halign: 'right', textColor: SLICE_TEXT } },
            { content: fmtINR(sl.rent), styles: { ...sliceStyle, halign: 'right', textColor: SLICE_TEXT } },
            { content: '', styles: sliceStyle },
            { content: '', styles: sliceStyle },
          ]);
        });
      }
    });

    // Distribute 190mm across 8 columns. Money columns wider; bag count narrow.
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Description', 'Bill / Rec #', 'In', 'Out', 'Rent (₹)', 'Paid (₹)', 'Balance (₹)']],
      body,
      theme: 'grid',
      headStyles: { fillColor: HEADER_FILL, fontSize: 8.5, halign: 'center', font, textColor: [255, 255, 255] },
      bodyStyles: { fontSize: 8.5, cellPadding: 2, font },
      columnStyles: {
        0: { cellWidth: 20 },  // Date
        1: { cellWidth: 50 },  // Description (longest)
        2: { cellWidth: 24 },  // Bill / Rec #
        3: { cellWidth: 10, halign: 'right' },  // In
        4: { cellWidth: 10, halign: 'right' },  // Out
        5: { cellWidth: 22, halign: 'right' },  // Rent
        6: { cellWidth: 22, halign: 'right' },  // Paid
        7: { cellWidth: 32, halign: 'right' },  // Balance
      },
      margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ---- Footer on every page ----
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Thin separator line above footer
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(10, 285, pageWidth - 10, 285);
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 10, 290, { align: 'right' });
    doc.text(`${opts.customer.name}  |  Generated ${fmtDate(new Date())}  |  Computer-generated statement`, 10, 290);
    doc.setTextColor(0);
  }

  const safeName = opts.customer.name.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  doc.save(`statement-${safeName}-${new Date().toISOString().split('T')[0]}.pdf`);
}
