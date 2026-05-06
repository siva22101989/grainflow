/**
 * PDF export primitives that mirror exportToExcel / exportToExcelWithFilters.
 *
 * Uses jspdf + jspdf-autotable (already in package.json) and lazy-imports
 * both libs to keep them out of the main bundle. Output is landscape A4 with
 * a header (title + date), optional filter strip, then a striped table.
 */

import type { ExportMetadata } from './export-utils-filtered';

const HEADER_FILL: [number, number, number] = [22, 78, 99];   // teal-900
const ALT_ROW_FILL: [number, number, number] = [245, 247, 250]; // slate-50

/** Format any cell value as a printable string. Numbers get Indian-locale grouping. */
function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString('en-IN');
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

async function loadPdf() {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  // jspdf-autotable v5 exports the function as default.
  const autoTable = (autoTableMod as any).default ?? autoTableMod;
  return { jsPDF, autoTable };
}

function downloadPdf(doc: any, filename: string) {
  doc.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Export a single tabular dataset to a landscape A4 PDF.
 * Mirrors the signature of exportToExcel.
 */
export async function exportToPdf<T extends Record<string, any>>(
  data: T[],
  filename: string,
  title: string = 'Report',
) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 21);
  doc.setTextColor(0);

  if (data.length > 0) {
    const headers = Object.keys(data[0]!);
    const rows = data.map((row) => headers.map((h) => formatCell(row[h])));
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 26,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: HEADER_FILL, textColor: 255 },
      alternateRowStyles: { fillColor: ALT_ROW_FILL },
      margin: { left: 10, right: 10, bottom: 15 },
    });
  } else {
    doc.text('No data available.', 14, 35);
  }

  downloadPdf(doc, filename);
}

/**
 * Export a tabular dataset to PDF with a filter/summary header.
 * Mirrors exportToExcelWithFilters.
 */
export async function exportToPdfWithFilters<T extends Record<string, any>>(
  data: T[],
  filename: string,
  metadata: ExportMetadata,
  title: string = 'Report',
) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated: ${metadata.exportDate.toLocaleString()}`, 14, 21);
  doc.text(`Records: ${metadata.filteredRecords} of ${metadata.totalRecords}`, 14, 26);

  let y = 31;
  if (metadata.appliedFilters.length > 0) {
    doc.setFontSize(8);
    const filterLine = metadata.appliedFilters.map((f) => `${f.label}: ${f.value}`).join('   |   ');
    const wrapped = doc.splitTextToSize(`Filters: ${filterLine}`, 270);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 4;
  }
  doc.setTextColor(0);

  if (data.length > 0) {
    const headers = Object.keys(data[0]!);
    const rows = data.map((row) => headers.map((h) => formatCell(row[h])));
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: y + 2,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: HEADER_FILL, textColor: 255 },
      alternateRowStyles: { fillColor: ALT_ROW_FILL },
      margin: { left: 10, right: 10, bottom: 15 },
    });
  } else {
    doc.text('No data available.', 14, y + 5);
  }

  downloadPdf(doc, filename);
}

/**
 * Multi-section financial report PDF: Summary, Top Customers, Aging.
 * Mirrors exportFinancialReportToExcel.
 */
export async function exportFinancialReportToPdf(data: {
  summary: { label: string; value: number }[];
  topCustomers: { name: string; revenue: number; paid: number; outstanding: number }[];
  aging: { range: string; count: number; amount: number }[];
}) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(18);
  doc.text('Financial Report', 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
  doc.setTextColor(0);

  // Summary
  doc.setFontSize(13);
  doc.text('Summary', 14, 35);
  autoTable(doc, {
    head: [['Metric', 'Value']],
    body: data.summary.map((r) => [r.label, formatCell(r.value)]),
    startY: 38,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: HEADER_FILL, textColor: 255 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // Top Customers
  let y = (doc as any).lastAutoTable?.finalY ?? 50;
  doc.setFontSize(13);
  doc.text('Top Customers', 14, y + 10);
  autoTable(doc, {
    head: [['Customer', 'Revenue', 'Paid', 'Outstanding']],
    body: data.topCustomers.map((c) => [
      c.name,
      formatCell(c.revenue),
      formatCell(c.paid),
      formatCell(c.outstanding),
    ]),
    startY: y + 13,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: HEADER_FILL, textColor: 255 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    alternateRowStyles: { fillColor: ALT_ROW_FILL },
    margin: { left: 14, right: 14 },
  });

  // Aging Analysis
  y = (doc as any).lastAutoTable?.finalY ?? y + 30;
  doc.setFontSize(13);
  doc.text('Aging Analysis', 14, y + 10);
  autoTable(doc, {
    head: [['Range', 'Count', 'Amount']],
    body: data.aging.map((a) => [a.range, formatCell(a.count), formatCell(a.amount)]),
    startY: y + 13,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: HEADER_FILL, textColor: 255 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    alternateRowStyles: { fillColor: ALT_ROW_FILL },
    margin: { left: 14, right: 14 },
  });

  downloadPdf(doc, 'financial-report');
}
