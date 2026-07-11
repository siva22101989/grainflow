// import * as XLSX from 'xlsx'; // Removed for lazy loading
import type { StorageRecord, Customer } from './definitions';
import { formatCurrency } from './utils';
import { format } from 'date-fns';
import { exportToPdf, exportFinancialReportToPdf } from './export-pdf-utils';

/**
 * Output format selector for every public exporter.
 * - 'excel' (default): xlsx via ExcelJS
 * - 'pdf': landscape A4 PDF via jspdf-autotable
 * Backward-compatible: existing call sites that omit format keep getting Excel.
 */
export type ExportFormat = 'excel' | 'pdf';

async function dispatchExport<T extends Record<string, any>>(
    data: T[],
    filename: string,
    sheetName: string,
    format: ExportFormat,
) {
    if (format === 'pdf') return exportToPdf(data, filename, sheetName);
    return exportToExcel(data, filename, sheetName);
}

/**
 * Shape of the JSON snapshot produced by Settings → Data Backup → Export.
 * Keep in sync with handleExport in src/components/settings/data-management-tab.tsx.
 */
export interface FullBackupData {
    timestamp: string;
    version?: string;
    warehouse: any;
    sequences: any[];
    customers: any[];
    storage_records: any[];
    withdrawal_transactions: any[];
    unloading_records: any[];
    stock_movements: any[];
    payments: any[];
    expenses: any[];
    crops: any[];
    lots: any[];
    notifications: any[];
}

/**
 * Multi-sheet Excel workbook of an entire warehouse snapshot.
 *
 * One tab per table plus a Summary tab with row counts and the
 * "view-only" caveat. Object/array cells are JSON-stringified so they
 * render as text instead of "[object Object]".
 *
 * NOT round-trippable: this file cannot be re-imported. Use the JSON
 * backup for restore.
 */
export async function exportFullBackupToExcel(backup: FullBackupData) {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();

    // Summary sheet
    const summary = workbook.addWorksheet('Summary');
    summary.addRow(['GrainFlow Full Backup']);
    summary.addRow(['Generated', new Date(backup.timestamp).toLocaleString()]);
    summary.addRow(['Warehouse', backup.warehouse?.name || 'N/A']);
    summary.addRow(['Version', backup.version || '1.0']);
    summary.addRow([]);
    summary.addRow(['Table', 'Row Count']);
    const counts: Array<[string, number]> = [
        ['Customers', backup.customers.length],
        ['Storage Records', backup.storage_records.length],
        ['Withdrawals', backup.withdrawal_transactions.length],
        ['Unloading Records', backup.unloading_records.length],
        ['Stock Movements', backup.stock_movements.length],
        ['Payments', backup.payments.length],
        ['Expenses', backup.expenses.length],
        ['Crops', backup.crops.length],
        ['Lots', backup.lots.length],
        ['Sequences', backup.sequences.length],
        ['Notifications (last 1000)', backup.notifications.length],
    ];
    counts.forEach((row) => summary.addRow(row));
    summary.addRow([]);
    summary.addRow(['NOTE', 'This Excel file is view-only. To restore data, import the JSON backup.']);
    summary.getColumn(1).width = 28;
    summary.getColumn(2).width = 36;

    function addTableSheet(name: string, rows: any[]) {
        const ws = workbook.addWorksheet(name);
        if (!rows || rows.length === 0) {
            ws.addRow(['No data']);
            return;
        }
        const headers = Object.keys(rows[0]);
        ws.columns = headers.map((h) => ({ header: h, key: h, width: 18 }));
        rows.forEach((row) => {
            const cleaned: Record<string, any> = {};
            for (const h of headers) {
                const v = row[h];
                cleaned[h] = v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
            }
            ws.addRow(cleaned);
        });
    }

    addTableSheet('Customers', backup.customers);
    addTableSheet('Storage Records', backup.storage_records);
    addTableSheet('Withdrawals', backup.withdrawal_transactions);
    addTableSheet('Unloading Records', backup.unloading_records);
    addTableSheet('Stock Movements', backup.stock_movements);
    addTableSheet('Payments', backup.payments);
    addTableSheet('Expenses', backup.expenses);
    addTableSheet('Crops', backup.crops);
    addTableSheet('Lots', backup.lots);
    addTableSheet('Sequences', backup.sequences);
    addTableSheet('Notifications', backup.notifications);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grainflow-backup-${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
}

/**
 * Simple warehouse-wide statement-style Excel: one Inflows sheet, one
 * Outflows sheet, plus a Summary. Each row carries customer name & phone
 * resolved client-side from the customers table, so the spreadsheet is
 * readable without joining UUIDs.
 *
 * Soft-deleted rows (deleted_at IS NOT NULL) are excluded — this view
 * matches what the Customer Statement shows on screen.
 */
export async function exportSimpleLedgerToExcel(backup: FullBackupData) {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();

    const fmtDate = (v: any) => {
        if (!v) return '';
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? '' : format(d, 'dd MMM yyyy');
    };
    const num = (v: any) => (v === null || v === undefined ? 0 : Number(v));

    // customer_id -> {name, phone, customer_number}
    const customerById = new Map<string, any>();
    for (const c of backup.customers || []) customerById.set(c.id, c);

    // storage_record_id -> storage_record (for outflows to read commodity/customer)
    const storageById = new Map<string, any>();
    for (const r of backup.storage_records || []) storageById.set(r.id, r);

    const inflows = (backup.storage_records || [])
        .filter((r: any) => !r.deleted_at)
        .map((r: any) => {
            const c = customerById.get(r.customer_id) || {};
            return {
                date: r.storage_start_date,
                billNo: r.record_number || '',
                customer: c.name || '',
                phone: c.phone || '',
                commodity: r.commodity_description || '',
                bagsIn: num(r.bags_in),
                bagsStored: num(r.bags_stored),
                rentBilled: num(r.total_rent_billed),
                hamali: num(r.hamali_payable),
                insurance: num(r.insurance_payable),
                location: r.location || '',
                lorryNo: r.lorry_tractor_no || '',
                notes: r.notes || '',
            };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const outflows = (backup.withdrawal_transactions || [])
        .filter((w: any) => !w.deleted_at)
        .map((w: any) => {
            const sr = storageById.get(w.storage_record_id) || {};
            const c = customerById.get(sr.customer_id) || {};
            return {
                date: w.withdrawal_date,
                invoiceNo: w.consolidated_invoice_no || w.withdrawal_number || '',
                customer: c.name || '',
                phone: c.phone || '',
                commodity: sr.commodity_description || '',
                bagsOut: num(w.bags_withdrawn),
                rent: num(w.rent_collected),
                hamali: num(w.hamali_charged),
                insurance: num(w.insurance_charged),
                discount: num(w.discount),
                linkedBillNo: sr.record_number || '',
            };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Totals
    const totalBagsIn = inflows.reduce((s, r) => s + r.bagsIn, 0);
    const totalBagsOut = outflows.reduce((s, r) => s + r.bagsOut, 0);
    const balanceStock = inflows.reduce((s, r) => s + r.bagsStored, 0);
    const totalRentBilled = inflows.reduce((s, r) => s + r.rentBilled, 0);
    const totalHamali = inflows.reduce((s, r) => s + r.hamali, 0);
    const totalInsurance = inflows.reduce((s, r) => s + r.insurance, 0);
    const totalPaid = (backup.payments || []).reduce((s, p: any) => s + num(p.amount), 0);

    // Summary sheet
    const summary = workbook.addWorksheet('Summary');
    summary.addRow(['GrainFlow — Inflow / Outflow Statement']);
    summary.addRow(['Warehouse', backup.warehouse?.name || 'N/A']);
    summary.addRow(['Generated', new Date(backup.timestamp).toLocaleString()]);
    summary.addRow([]);
    summary.addRow(['Bags Summary']);
    summary.addRow(['Total Inflows (records)', inflows.length]);
    summary.addRow(['Total Outflows (records)', outflows.length]);
    summary.addRow(['Total Bags In', totalBagsIn]);
    summary.addRow(['Total Bags Out', totalBagsOut]);
    summary.addRow(['Balance Stock', balanceStock]);
    summary.addRow([]);
    summary.addRow(['Money Summary']);
    summary.addRow(['Total Rent Billed', totalRentBilled]);
    summary.addRow(['Total Hamali', totalHamali]);
    summary.addRow(['Total Insurance', totalInsurance]);
    summary.addRow(['Total Paid', totalPaid]);
    summary.addRow(['Balance Due', totalRentBilled + totalHamali + totalInsurance - totalPaid]);
    summary.getColumn(1).width = 28;
    summary.getColumn(2).width = 22;
    summary.getRow(1).font = { bold: true, size: 14 };
    summary.getRow(5).font = { bold: true };
    summary.getRow(12).font = { bold: true };

    // Inflows sheet
    const inSheet = workbook.addWorksheet('Inflows');
    inSheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Bill No', key: 'billNo', width: 12 },
        { header: 'Customer', key: 'customer', width: 24 },
        { header: 'Phone', key: 'phone', width: 14 },
        { header: 'Commodity', key: 'commodity', width: 18 },
        { header: 'Bags In', key: 'bagsIn', width: 10 },
        { header: 'Bags Stored', key: 'bagsStored', width: 12 },
        { header: 'Rent Billed', key: 'rentBilled', width: 14 },
        { header: 'Hamali', key: 'hamali', width: 12 },
        { header: 'Insurance', key: 'insurance', width: 12 },
        { header: 'Location', key: 'location', width: 12 },
        { header: 'Lorry No', key: 'lorryNo', width: 14 },
        { header: 'Notes', key: 'notes', width: 24 },
    ];
    inSheet.getRow(1).font = { bold: true };
    inflows.forEach(r => inSheet.addRow({ ...r, date: fmtDate(r.date) }));

    // Outflows sheet
    const outSheet = workbook.addWorksheet('Outflows');
    outSheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Invoice No', key: 'invoiceNo', width: 14 },
        { header: 'Customer', key: 'customer', width: 24 },
        { header: 'Phone', key: 'phone', width: 14 },
        { header: 'Commodity', key: 'commodity', width: 18 },
        { header: 'Bags Out', key: 'bagsOut', width: 10 },
        { header: 'Rent Collected', key: 'rent', width: 14 },
        { header: 'Hamali', key: 'hamali', width: 12 },
        { header: 'Insurance', key: 'insurance', width: 12 },
        { header: 'Discount', key: 'discount', width: 12 },
        { header: 'Linked Bill No', key: 'linkedBillNo', width: 14 },
    ];
    outSheet.getRow(1).font = { bold: true };
    outflows.forEach(r => outSheet.addRow({ ...r, date: fmtDate(r.date) }));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grainflow-statement-${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
}

/**
 * Generate Customer Statement using browser print dialog
 * This opens a new window with a printable statement that can be saved as PDF
 */
export function generateCustomerStatement(
    customer: Customer,
    records: StorageRecord[],
    warehouseName: string = 'Warehouse'
) {
    // Calculate totals
    let totalRent = 0;
    let totalHamali = 0;
    let totalPaid = 0;
    
    records.forEach(r => {
        totalRent += r.totalRentBilled || 0;
        totalHamali += r.hamaliPayable || 0;
        const payments = r.payments || [];
        totalPaid += payments.reduce((sum, p) => sum + p.amount, 0);
    });
    
    const totalBilled = totalRent + totalHamali;
    const balance = totalBilled - totalPaid;
    
    // Generate table rows
    const tableRows = records.map(r => {
        const payments = r.payments || [];
        const paid = payments.reduce((sum, p) => sum + p.amount, 0);
        const billed = (r.totalRentBilled || 0) + (r.hamaliPayable || 0);
        
        return `
            <tr>
                <td>${r.recordNumber || r.id.substring(0, 8)}</td>
                <td>${new Date(r.storageStartDate).toLocaleDateString()}</td>
                <td>${r.commodityDescription || '-'}</td>
                <td>${r.bagsStored}</td>
                <td>${formatCurrency(billed)}</td>
                <td>${formatCurrency(paid)}</td>
                <td>${formatCurrency(billed - paid)}</td>
            </tr>
        `;
    }).join('');
    
    // Create HTML content
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Customer Statement - ${customer.name}</title>
            <style>
                @media print {
                    @page { margin: 1cm; }
                    body { margin: 0; }
                }
                
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    max-width: 210mm;
                    margin: 0 auto;
                }
                
                .header {
                    text-align: left;
                    margin-bottom: 30px;
                }
                
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                    color: #2c3e50;
                }
                
                .header h2 {
                    margin: 5px 0 0 0;
                    font-size: 18px;
                    color: #34495e;
                    font-weight: normal;
                }
                
                .customer-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    font-size: 11px;
                }
                
                .customer-details p {
                    margin: 3px 0;
                }
                
                .summary-box {
                    background: #f5f5f5;
                    border: 1px solid #ddd;
                    padding: 15px;
                    margin-bottom: 20px;
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                }
                
                .summary-item {
                    text-align: center;
                }
                
                .summary-label {
                    font-size: 10px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                
                .summary-value {
                    font-size: 14px;
                }
                
                .balance-due {
                    color: ${balance > 0 ? '#e74c3c' : '#27ae60'};
                    font-weight: bold;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    font-size: 10px;
                }
                
                th {
                    background: #3498db;
                    color: white;
                    padding: 8px;
                    text-align: left;
                    font-weight: bold;
                }
                
                td {
                    padding: 6px 8px;
                    border: 1px solid #ddd;
                }
                
                tr:nth-child(even) {
                    background: #f9f9f9;
                }
                
                .footer {
                    text-align: center;
                    font-size: 9px;
                    color: #7f8c8d;
                    font-style: italic;
                    margin-top: 30px;
                }
                
                .no-print {
                    text-align: center;
                    margin: 20px 0;
                }
                
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${warehouseName}</h1>
                <h2>Customer Statement</h2>
            </div>
            
            <div class="customer-info">
                <div class="customer-details">
                    <p><strong>Customer:</strong> ${customer.name}</p>
                    <p><strong>Phone:</strong> ${customer.phone || ''}</p>
                    ${customer.email ? `<p><strong>Email:</strong> ${customer.email}</p>` : ''}
                    ${customer.village ? `<p><strong>Village:</strong> ${customer.village}</p>` : ''}
                </div>
                <div>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
            </div>
            
            <div class="summary-box">
                <div class="summary-item">
                    <div class="summary-label">Total Rent</div>
                    <div class="summary-value">${formatCurrency(totalRent)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Hamali</div>
                    <div class="summary-value">${formatCurrency(totalHamali)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Paid</div>
                    <div class="summary-value">${formatCurrency(totalPaid)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Balance Due</div>
                    <div class="summary-value balance-due">${formatCurrency(balance)}</div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Record #</th>
                        <th>Date</th>
                        <th>Commodity</th>
                        <th>Bags</th>
                        <th>Billed</th>
                        <th>Paid</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            
            <div class="footer">
                This is a computer-generated statement.
            </div>
            
            <div class="no-print">
                <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; background: #3498db; color: white; border: none; border-radius: 4px;">
                    Print / Save as PDF
                </button>
                <button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; background: #95a5a6; color: white; border: none; border-radius: 4px; margin-left: 10px;">
                    Close
                </button>
            </div>
        </body>
        </html>
    `;
    
    // Open in new window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Auto-trigger print dialog after a short delay
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }
}

/**
 * Generate Monthly Summary PDF Report
 */
/**
 * Generate Monthly Summary Report using browser print dialog
 */
export function generateMonthlySummaryPDF(
    month: string,
    data: {
        totalRevenue: number;
        rentRevenue: number;
        hamaliRevenue: number;
        totalCollected: number;
        outstanding: number;
        newInflows: number;
        completedOutflows: number;
        activeStock: number;
    },
    warehouseName: string = 'Warehouse'
) {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Monthly Summary - ${month}</title>
            <style>
                @media print {
                    @page { margin: 1.5cm; }
                    body { margin: 0; }
                    .no-print { display: none; }
                }
                
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    max-width: 210mm;
                    margin: 0 auto;
                    color: #333;
                }
                
                .header {
                    margin-bottom: 40px;
                    border-bottom: 2px solid #3498db;
                    padding-bottom: 20px;
                }
                
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                    color: #2c3e50;
                }
                
                .header h2 {
                    margin: 10px 0 0 0;
                    font-size: 18px;
                    color: #7f8c8d;
                    font-weight: normal;
                }
                
                .meta {
                    margin-top: 10px;
                    font-size: 12px;
                    color: #95a5a6;
                }
                
                .section {
                    margin-bottom: 40px;
                }
                
                .section-title {
                    font-size: 16px;
                    font-weight: bold;
                    color: #2980b9;
                    margin-bottom: 15px;
                    text-transform: uppercase;
                    border-left: 4px solid #3498db;
                    padding-left: 10px;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                
                td {
                    padding: 12px 15px;
                    border-bottom: 1px solid #eee;
                }
                
                tr:last-child td {
                    border-bottom: none;
                }
                
                .label {
                    font-weight: bold;
                    width: 60%;
                }
                
                .value {
                    text-align: right;
                    font-family: monospace;
                    font-size: 14px;
                }
                
                .sub-label {
                    padding-left: 20px;
                    color: #666;
                    font-style: italic;
                }
                
                .footer {
                    margin-top: 50px;
                    text-align: center;
                    font-size: 10px;
                    color: #bdc3c7;
                }
                
                .no-print {
                    text-align: center;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${warehouseName}</h1>
                <h2>Monthly Summary Report - ${month}</h2>
                <div class="meta">Generated: ${new Date().toLocaleString()}</div>
            </div>
            
            <div class="section">
                <div class="section-title">Financial Summary</div>
                <table>
                    <tr>
                        <td class="label">Total Revenue</td>
                        <td class="value">${formatCurrency(data.totalRevenue)}</td>
                    </tr>
                    <tr>
                        <td class="label sub-label">- Rent Revenue</td>
                        <td class="value">${formatCurrency(data.rentRevenue)}</td>
                    </tr>
                    <tr>
                        <td class="label sub-label">- Hamali Revenue</td>
                        <td class="value">${formatCurrency(data.hamaliRevenue)}</td>
                    </tr>
                    <tr>
                        <td class="label">Total Collected</td>
                        <td class="value">${formatCurrency(data.totalCollected)}</td>
                    </tr>
                    <tr>
                        <td class="label">Outstanding Dues</td>
                        <td class="value" style="color: #e74c3c;">${formatCurrency(data.outstanding)}</td>
                    </tr>
                </table>
            </div>
            
            <div class="section">
                <div class="section-title">Operational Summary</div>
                <table>
                    <tr>
                        <td class="label">New Inflows</td>
                        <td class="value">${data.newInflows}</td>
                    </tr>
                    <tr>
                        <td class="label">Completed Outflows</td>
                        <td class="value">${data.completedOutflows}</td>
                    </tr>
                    <tr>
                        <td class="label">Active Stock (Bags)</td>
                        <td class="value">${data.activeStock}</td>
                    </tr>
                </table>
            </div>
            
            <div class="footer">
                This report is computer-generated.
            </div>
            
            <div class="no-print">
                <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; background: #3498db; color: white; border: none; border-radius: 4px;">
                    Print / Save as PDF
                </button>
                <button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; background: #95a5a6; color: white; border: none; border-radius: 4px; margin-left: 10px;">
                    Close
                </button>
            </div>
        </body>
        </html>
    `;
    
    // Open in new window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Auto-trigger print dialog after a short delay
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }
}

/**
 * Export data to Excel file using ExcelJS
 * 
 * Generic function to export any array of objects to Excel format.
 * Automatically extracts headers from object keys and creates worksheet.
 * Downloads file with timestamp appended to filename.
 * 
 * @param data - Array of objects to export (objects should have consistent keys)
 * @param filename - Base filename without extension (timestamp auto-appended)
 * @param sheetName - Name of the worksheet tab (default: 'Sheet1')
 * 
 * @example Export customer data
 * ```typescript
 * const customers = [
 *   { name: 'John Doe', phone: '+911234567890', balance: 5000 },
 *   { name: 'Jane Smith', phone: '+919876543210', balance: 3000 }
 * ];
 * 
 * await exportToExcel(customers, 'customer-list', 'Customers');
 * // Downloads: customer-list-2024-01-24.xlsx
 * ```
 */
export async function exportToExcel<T extends Record<string, any>>(
    data: T[],
    filename: string,
    sheetName: string = 'Sheet1'
) {
    // Dynamic import ExcelJS
    const ExcelJS = await import('exceljs');
    
    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);
    
    // Convert data to rows (header + data rows)
    if (data.length > 0) {
        // Extract headers from first object
        const headers = Object.keys(data[0]!);
        worksheet.columns = headers.map(header => ({
            header,
            key: header,
            width: 15
        }));
        
        // Add data rows
        data.forEach(row => {
            worksheet.addRow(row);
        });
    }
    
    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Create blob and trigger download
    const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
}

/**
 * Export storage records to Excel
 * 
 * Formats storage records into Excel with columns for record number, dates,
 * commodity, location, bags stored, financials, and status.
 * 
 * @param records - Array of storage records to export
 * 
 * @example
 * ```typescript
 * const records = await getStorageRecords({ status: 'active' });
 * exportStorageRecordsToExcel(records);
 * // Downloads: storage-records-2024-01-24.xlsx
 * ```
 */
export function exportStorageRecordsToExcel(records: StorageRecord[], format: ExportFormat = 'excel') {
    const data = records.map(r => ({
        'Record Number': r.recordNumber || r.id.substring(0, 8),
        'Date': new Date(r.storageStartDate).toLocaleDateString(),
        'Commodity': r.commodityDescription || '-',
        'Location': r.location || '-',
        'Bags Stored': r.bagsStored,
        'Hamali Payable': r.hamaliPayable || 0,
        'Rent Billed': r.totalRentBilled || 0,
        'Status': r.storageEndDate ? 'Completed' : 'Active',
        'End Date': r.storageEndDate ? new Date(r.storageEndDate).toLocaleDateString() : '-'
    }));

    return dispatchExport(data, 'storage-records', 'Storage Records', format);
}

/**
 * Export customers with their stats to Excel
 * 
 * Exports customer list with name, contact info, and current storage statistics.
 * Requires pre-computed recordsMap with customer stats (active bags, total due).
 * 
 * @param customers - Array of customer records
 * @param recordsMap - Map of customer ID to their storage stats
 * 
 * @example
 * ```typescript
 * const customers = await getCustomers();
 * const recordsMap = new Map();
 * 
 * // Build stats map
 * const records = await getActiveRecords();
 * records.forEach(r => {
 *   const stats = recordsMap.get(r.customerId) || { activeBags: 0, totalDue: 0 };
 *   stats.activeBags += r.bagsStored;
 *   stats.totalDue += r.balanceDue;
 *   recordsMap.set(r.customerId, stats);
 * });
 * 
 * exportCustomersToExcel(customers, recordsMap);
 * ```
 */
export function exportCustomersToExcel(
    customers: Customer[],
    recordsMap: Map<string, { activeBags: number; totalDue: number }>,
    format: ExportFormat = 'excel',
) {
    const data = customers.map(c => {
        const stats = recordsMap.get(c.id) || { activeBags: 0, totalDue: 0 };
        return {
            'Name': c.name,
            'Phone': c.phone,
            'Email': c.email || '-',
            'Village': c.village || '-',
            'Father Name': c.fatherName || '-',
            'Active Bags': stats.activeBags,
            'Total Due': stats.totalDue
        };
    });

    return dispatchExport(data, 'customers', 'Customers', format);
}

/**
 * Export financial report to Excel with multiple sheets
 * 
 * Creates a comprehensive financial Excel workbook with three sheets:
 * 1. Summary - Key financial metrics (revenue, expenses, profit)
 * 2. Top Customers - Customer revenue breakdown
 * 3. Aging Analysis - Outstanding receivables by age buckets
 * 
 * @param data - Financial data object containing summary, topCustomers, and aging arrays
 * @param data.summary - Array of {label, value} for summary metrics
 * @param data.topCustomers - Array of customer revenue data
 * @param data.aging - Array of aging bucket data {range, count, amount}
 * 
 * @example
 * ```typescript
 * const financialData = {
 *   summary: [
 *     { label: 'Total Revenue', value: 500000 },
 *     { label: 'Total Collected', value: 450000 },
 *     { label: 'Outstanding', value: 50000 }
 *   ],
 *   topCustomers: [
 *     { name: 'Customer A', revenue: 100000, paid: 90000, outstanding: 10000 }
 *   ],
 *   aging: [
 *     { range: '0-30 days', count: 10, amount: 5000 }
 *   ]
 * };
 * 
 * await exportFinancialReportToExcel(financialData);
 * // Downloads: financial-report-2024-01-24.xlsx with 3 sheets
 * ```
 */
export async function exportFinancialReportToExcel(
    data: {
        summary: { label: string; value: number }[];
        topCustomers: { name: string; revenue: number; paid: number; outstanding: number }[];
        aging: { range: string; count: number; amount: number }[];
    },
    format: ExportFormat = 'excel',
) {
    if (format === 'pdf') return exportFinancialReportToPdf(data);
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    // Summary sheet
    const summaryWs = workbook.addWorksheet('Summary');
    summaryWs.columns = [
        { header: 'label', key: 'label', width: 20 },
        { header: 'value', key: 'value', width: 15 }
    ];
    data.summary.forEach(row => summaryWs.addRow(row));
    
    // Top Customers sheet
    const customersWs = workbook.addWorksheet('Top Customers');
    customersWs.columns = [
        { header: 'name', key: 'name', width: 20 },
        { header: 'revenue', key: 'revenue', width: 15 },
        { header: 'paid', key: 'paid', width: 15 },
        { header: 'outstanding', key: 'outstanding', width: 15 }
    ];
    data.topCustomers.forEach(row => customersWs.addRow(row));
    
    // Aging Analysis sheet
    const agingWs = workbook.addWorksheet('Aging Analysis');
    agingWs.columns = [
        { header: 'range', key: 'range', width: 20 },
        { header: 'count', key: 'count', width: 15 },
        { header: 'amount', key: 'amount', width: 15 }
    ];
    data.aging.forEach(row => agingWs.addRow(row));
    
    // Generate buffer and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
}

/**
 * Export Unloading Register
 */
export function exportUnloadingRegisterToExcel(records: any[], format: ExportFormat = 'excel') {
    const data = records.map(r => ({
        'Date': r.unload_date ? new Date(r.unload_date).toLocaleDateString() : '-',
        'Customer': r.customer?.name || 'Unknown',
        'Commodity': r.commodity_description,
        'Lorry No': r.lorry_tractor_no || '-',
        'Bags Unloaded': r.bags_unloaded,
        'Hamali Amount': r.hamali_amount || 0,
        'Notes': r.notes || '-'
    }));
    return dispatchExport(data, 'unloading-register', 'Unloading', format);
}

/**
 * Export Hamali Revenue
 */
export function exportHamaliRevenueToExcel(records: any[], format: ExportFormat = 'excel') {
     const data = records.map(r => ({
        'Customer': r.customer?.name || 'Unknown',
        'Start Date': new Date(r.storageStartDate).toLocaleDateString(),
        'End Date': r.storageEndDate ? new Date(r.storageEndDate).toLocaleDateString() : 'Active',
        'Bags Stored': r.bagsStored,
        'Active Bags': r.storageEndDate ? 0 : r.bagsStored,
        'Hamali Payable': r.hamaliPayable || 0,
        'Total Billed': r.totalBilled || 0,
        'Amount Paid': r.amountPaid || 0,
        'Balance Due': r.balanceDue || 0
    }));
    return dispatchExport(data, 'hamali-revenue', 'Hamali Revenue', format);
}

/**
 * Export Pending Breakdown
 */
export function exportPendingBreakdownToExcel(data: any[], format: ExportFormat = 'excel') {
    const rows = data.map(r => ({
        'Customer': r.name,
        'Phone': r.phone,
        'Rent Billed': r.rentBilled,
        'Rent Paid': r.rentPaid,
        'Rent Due': r.rentPending,
        'Hamali Billed': r.hamaliBilled,
        'Hamali Paid': r.hamaliPaid,
        'Hamali Due': r.hamaliPending,
        'Total Pending': r.totalPending
    }));
    return dispatchExport(rows, 'pending-dues-breakdown', 'Pending Dues', format);
}

/**
 * Export Unloading Expenses
 */
export function exportUnloadingExpensesToExcel(expenses: any[], format: ExportFormat = 'excel') {
    const data = expenses.map(e => ({
        'Date': new Date(e.date).toLocaleDateString(),
        'Description': e.description,
        'Amount': e.amount,
        'Category': e.category,
        'Payment Mode': e.payment_mode
    }));
    return dispatchExport(data, 'unloading-expenses', 'Expenses', format);
}

/**
 * Generate Custom Report PDF using browser print
 */
export function generateCustomReportPDF(
    reportType: string,
    data: any,
    warehouseName: string = 'Warehouse'
) {
    let title = '';
    let content = '';

    // 0. Customer Dues Details - STATEMENT OF ACCOUNT FORMAT
    if (reportType === 'customer-dues-details') {
         const customerName = data.customer?.name || 'Customer';
         title = `Statement of Account - ${customerName}`;
         
         // USE NEW STATEMENT OF ACCOUNT FORMAT
         if (data.transactions && data.summary) {
           const { transactions, summary } = data;
           
           const ledgerRows = transactions.map((t: any) => `
             <tr style="font-size: 11px;">
               <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${new Date(t.date).toLocaleDateString()}</td>
               <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${t.description}</td>
               <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${t.invoiceNo}</td>
               <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${t.bagsIn || ''}</td>
               <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${t.bagsOut || ''}</td>
               <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${t.hamali !== null && t.hamali !== undefined ? formatCurrency(t.hamali) : ''}</td>
               <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${t.insurance !== null && t.insurance !== undefined ? formatCurrency(t.insurance) : ''}</td>
               <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${t.rent !== null && t.rent !== undefined ? formatCurrency(t.rent) : ''}</td>
               <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${t.credit !== null && t.credit !== undefined ? formatCurrency(t.credit) : ''}</td>
               <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${formatCurrency(t.balance)}</td>
             </tr>
           `).join('');
           
           content = `
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
               <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                 <table style="width: 100%; font-size: 12px;">
                   <tr><td><strong>Total Bags In:</strong></td><td style="text-align: right;">${summary.totalBagsIn}</td></tr>
                   <tr><td><strong>Total Bags Out:</strong></td><td style="text-align: right;">${summary.totalBagsOut}</td></tr>
                   <tr><td><strong>Balance Stock:</strong></td><td style="text-align: right; font-weight: bold;">${summary.balanceStock}</td></tr>
                 </table>
               </div>
               <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                 <table style="width: 100%; font-size: 12px;">
                   <tr><td><strong>Total Hamali:</strong></td><td style="text-align: right;">₹${formatCurrency(summary.totalHamali)}</td></tr>
                   ${summary.totalInsurance > 0 ? `<tr><td><strong>Total Insurance:</strong></td><td style="text-align: right;">₹${formatCurrency(summary.totalInsurance)}</td></tr>` : ''}
                   <tr><td><strong>Total Rent:</strong></td><td style="text-align: right;">₹${formatCurrency(summary.totalRent)}</td></tr>
                   <tr><td><strong>Total Paid:</strong></td><td style="text-align: right;">₹${formatCurrency(summary.totalPaid)}</td></tr>
                   <tr><td><strong>Balance Due:</strong></td><td style="text-align: right; font-weight: bold; color: #e74c3c;">₹${formatCurrency(summary.balanceDue)}</td></tr>
                 </table>
               </div>
             </div>
             
             <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px;">
               <thead>
                 <tr style="background-color: #34495e; color: white;">
                   <th style="padding: 10px 8px; text-align: left; border: 1px solid #2c3e50;">Date</th>
                   <th style="padding: 10px 8px; text-align: left; border: 1px solid #2c3e50;">Description</th>
                   <th style="padding: 10px 8px; text-align: left; border: 1px solid #2c3e50;">Invoice No</th>
                   <th style="padding: 10px 8px; text-align: right; border: 1px solid #2c3e50; width: 80px;">Bags In</th>
                   <th style="padding: 10px 8px; text-align: right; border: 1px solid #2c3e50; width: 80px;">Bags Out</th>
                   <th style="padding: 10px 8px; text-align: right; border: 1px solid #2c3e50; width: 100px;">Hamali</th>
                   <th style="padding: 10px 8px; text-align: right; border: 1px solid #2c3e50; width: 100px;">Insurance</th>
                   <th style="padding: 10px 8px; text-align: right; border: 1px solid #2c3e50; width: 100px;">Rent</th>
                   <th style="padding: 10px 8px; text-align: right; border: 1px solid #2c3e50; width: 100px;">Credit</th>
                   <th style="padding: 10px 8px; text-align: right; border: 1px solid #2c3e50; width: 100px;">Balance</th>
                 </tr>
               </thead>
               <tbody>
                 ${ledgerRows}
                 <tr style="font-weight: bold; background-color: #ecf0f1;">
                   <td colspan="3" style="padding: 10px 8px; border-top: 2px solid #34495e;">Totals:</td>
                   <td style="padding: 10px 8px; text-align: right; border-top: 2px solid #34495e;">${summary.totalBagsIn}</td>
                   <td style="padding: 10px 8px; text-align: right; border-top: 2px solid #34495e;">${summary.totalBagsOut}</td>
                   <td style="padding: 10px 8px; text-align: right; border-top: 2px solid #34495e;">₹${formatCurrency(summary.totalHamali)}</td>
                   <td style="padding: 10px 8px; text-align: right; border-top: 2px solid #34495e;">₹${formatCurrency(summary.totalInsurance)}</td>
                   <td style="padding: 10px 8px; text-align: right; border-top: 2px solid #34495e;">₹${formatCurrency(summary.totalRent)}</td>
                   <td style="padding: 10px 8px; text-align: right; border-top: 2px solid #34495e;">₹${formatCurrency(summary.totalPaid)}</td>
                   <td style="padding: 10px 8px; text-align: right; border-top: 2px solid #34495e;">₹${formatCurrency(summary.balanceDue)}</td>
                 </tr>
               </tbody>
             </table>
           `;
         } else {
           content = `<p style="color: red;">Error: Statement of Account data not available. Please regenerate the report.</p>`;
         }
     }
     
     // 2. Active Inventory Report
     else if (reportType === 'active-inventory') {
        title = 'Active Inventory Report';
        
        // Group by Customer
        const groupedByCustomer = data.data.reduce((acc: any, r: any) => {
            const customerName = r.customers?.name || 'Unknown';
            if (!acc[customerName]) acc[customerName] = [];
            acc[customerName].push(r);
            return acc;
        }, {});

        const sortedCustomers = Object.keys(groupedByCustomer).sort();

        const totalBags = data.data.reduce((sum: number, r: any) => sum + r.bags_stored, 0);
        const avgDays = Math.round(data.data.reduce((sum: number, r: any) => sum + (r.daysInStorage || 0), 0) / data.data.length);
        
        // Count by age category
        const ageCounts = data.data.reduce((acc: any, r: any) => {
            acc[r.ageCategory] = (acc[r.ageCategory] || 0) + 1;
            return acc;
        }, {});

        const summaryHtml = `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; font-size: 12px;">
                    <div><strong>Total Records:</strong> ${data.data.length}</div>
                    <div><strong>Total Bags:</strong> ${totalBags}</div>
                    <div><strong>Avg Days in Storage:</strong> ${avgDays}</div>
                    <div style="color: #27ae60;"><strong>Recent (0-30d):</strong> ${ageCounts['Recent'] || 0}</div>
                    <div style="color: #f39c12;"><strong>Medium (30-90d):</strong> ${ageCounts['Medium'] || 0}</div>
                    <div style="color: #e67e22;"><strong>Old (90-180d):</strong> ${ageCounts['Old'] || 0}</div>
                    <div style="color: #e74c3c;"><strong>Very Old (>180d):</strong> ${ageCounts['Very Old'] || 0}</div>
                </div>
            </div>
        `;

        const customerTables = sortedCustomers.map(customerName => {
            const records = groupedByCustomer[customerName];
            const customerTotalBags = records.reduce((sum: number, r: any) => sum + r.bags_stored, 0);
            
            const rows = records.map((r: any) => {
                const ageColor = r.ageCategory === 'Very Old' ? '#e74c3c' :
                               r.ageCategory === 'Old' ? '#e67e22' :
                               r.ageCategory === 'Medium' ? '#f39c12' : '#27ae60';
                return `
                    <tr>
                        <td>${r.record_number || r.id.substring(0, 8)}</td>
                        <td>${new Date(r.storage_start_date).toLocaleDateString()}</td>
                        <td>${r.commodity_description || '-'}</td>
                        <td>${r.location || '-'}</td>
                        <td style="text-align: right">${r.bags_stored}</td>
                        <td style="text-align: right; font-weight: bold;">${r.daysInStorage || 0}</td>
                        <td><span style="color: ${ageColor}; font-weight: bold;">${r.ageCategory}</span></td>
                    </tr>
                `;
            }).join('');

            return `
                <div style="margin-bottom: 20px;">
                    <h3 style="background: #34495e; color: white; padding: 8px 12px; margin: 0; font-size: 14px; display: flex; justify-content: space-between;">
                        <span>${customerName}</span>
                        <span>Total Bags: ${customerTotalBags}</span>
                    </h3>
                    <table style="margin-top: 0;">
                        <thead>
                            <tr style="background-color: #ecf0f1; color: #333;">
                                <th>Record #</th>
                                <th>Date In</th>
                                <th>Commodity</th>
                                <th>Location</th>
                                <th style="text-align: right">Bags</th>
                                <th style="text-align: right">Days</th>
                                <th>Age</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `;
        }).join('');

        content = summaryHtml + customerTables;
    }
    
    // 3. Transaction History
    else if (reportType === 'transaction-history') {
        title = 'Transaction History (Last 1000 Records)';
        
        // Group transactions by date
        const groupedByDate = data.groupedByDate || {};
        const dates = Object.keys(groupedByDate).sort((a, b) => 
          new Date(b).getTime() - new Date(a).getTime()
        );
        
        let content = '';
        
        dates.forEach(dateKey => {
          const dayTransactions = groupedByDate[dateKey];
          
          // Calculate daily totals
          const dailyTotals = {
            inflowBags: dayTransactions.filter((t: any) => t.type === 'inflow').reduce((sum: number, t: any) => sum + (t.bags || 0), 0),
            outflowBags: dayTransactions.filter((t: any) => t.type === 'outflow').reduce((sum: number, t: any) => sum + (t.bags || 0), 0),
            payments: dayTransactions.filter((t: any) => t.type === 'payment').reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
            totalAmount: dayTransactions.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0)
          };
          
          const rows = dayTransactions.map((t: any) => {
            // Transaction type icon/indicator
            const typeIcon = t.type === 'inflow' ? '↓' : t.type === 'outflow' ? '↑' : '₹';
            const typeColor = t.type === 'inflow' ? '#27ae60' : t.type === 'outflow' ? '#e67e22' : '#3498db';
            const typeLabel = t.type.charAt(0).toUpperCase() + t.type.slice(1);
            
            return `
              <tr>
                <td><span style="color: ${typeColor}; font-weight: bold; font-size: 14px;">${typeIcon}</span> ${typeLabel}</td>
                <td>${t.recordNumber || '-'}</td>
                <td>${t.customerName || 'Unknown'}</td>
                <td>${t.description}</td>
                <td style="text-align: right">${t.bags > 0 ? t.bags : '-'}</td>
                <td style="text-align: right">${t.amount > 0 ? formatCurrency(t.amount) : '-'}</td>
              </tr>
            `;
          }).join('');
          
          content += `
            <div style="margin-top: 20px;">
              <h3 style="background: #34495e; color: white; padding: 8px 12px; margin: 0;">${dateKey}</h3>
              <table style="margin-top: 0;">
                <thead>
                  <tr>
                    <th style="width: 12%">Type</th>
                    <th style="width: 10%">Record #</th>
                    <th style="width: 18%">Customer</th>
                    <th style="width: 30%">Description</th>
                    <th style="width: 12%; text-align: right">Bags</th>
                    <th style="width: 18%; text-align: right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                  <tr style="background: #ecf0f1; font-weight: bold;">
                    <td colspan="4" style="text-align: right;">Daily Totals:</td>
                    <td style="text-align: right;">
                      ${dailyTotals.inflowBags > 0 ? `↓${dailyTotals.inflowBags}` : ''} 
                      ${dailyTotals.outflowBags > 0 ? `↑${dailyTotals.outflowBags}` : ''}
                    </td>
                    <td style="text-align: right;">₹${formatCurrency(dailyTotals.totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          `;
        });
        
        // Overall summary at top
        const totalTransactions = data.data.length;
        const totalInflows = data.data.filter((t: any) => t.type === 'inflow').length;
        const totalOutflows = data.data.filter((t: any) => t.type === 'outflow').length;
        const totalPayments = data.data.filter((t: any) => t.type === 'payment').length;
        
        content = `
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; font-size: 12px;">
              <div>
                <strong>Total Transactions:</strong> ${totalTransactions}
              </div>
              <div style="color: #27ae60;">
                <strong>Inflows:</strong> ${totalInflows}
              </div>
              <div style="color: #e67e22;">
                <strong>Outflows:</strong> ${totalOutflows}
              </div>
              <div style="color: #3498db;">
                <strong>Payments:</strong> ${totalPayments}
              </div>
            </div>
          </div>
          ${content}
        `;
    }
    
    // 4. Inflow Register
    else if (reportType === 'inflow-register') {
        const dateRange = formatDateRange(data.period);
        title = `Inflow Register ${dateRange}`;
        const rows = data.data.map((r: any) => {
            const originalQty = r.bags_in || r.bags_stored;
            return `
            <tr>
                <td>${new Date(r.storage_start_date).toLocaleDateString()}</td>
                <td>${r.record_number || r.id.substring(0, 8)}</td>
                <td>${r.customers?.name || 'Unknown'}</td>
                <td>${r.commodity_description || '-'}</td>
                <td style="text-align: right">${originalQty}</td>
            </tr>
        `}).join('');

        const totalBags = data.data.reduce((sum: number, r: any) => sum + (r.bags_in || r.bags_stored), 0);

        content = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Receipt #</th>
                        <th>Customer</th>
                        <th>Commodity</th>
                        <th style="text-align: right">Bags In</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                    <tr style="font-weight: bold; background-color: #f0f0f0;">
                        <td colspan="4" style="text-align: right;">Total Bags In:</td>
                        <td style="text-align: right;">${totalBags}</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    // 5. Outflow Register
    else if (reportType === 'outflow-register') {
        const dateRange = formatDateRange(data.period);
        title = `Outflow Register ${dateRange}`;
        const rows = data.data.map((r: any) => {
            const balance = Number(r.record_balance || 0);
            const paid = Number(r.record_total_paid || 0);
            const statusColor = balance === 0 && paid > 0 ? '#16a34a' : balance > 0 ? '#dc2626' : '#6b7280';
            return `
            <tr>
                <td>${new Date(r.storage_end_date).toLocaleDateString()}</td>
                <td>${r.record_number || r.id.substring(0, 8)}</td>
                <td>${r.customers?.name || 'Unknown'}</td>
                <td style="text-align: right">${r.bags_stored}</td>
                <td style="text-align: right">${formatCurrency(r.total_rent_billed)}</td>
                <td style="text-align: right">${formatCurrency(paid)}</td>
                <td style="text-align: right; color: ${statusColor}; font-weight: 600;">${formatCurrency(balance)}</td>
            </tr>
        `;
        }).join('');

        const totalRent = data.data.reduce((sum: number, r: any) => sum + (r.total_rent_billed || 0), 0);
        const totalPaid = data.data.reduce((sum: number, r: any) => sum + (r.record_total_paid || 0), 0);
        const totalBalance = data.data.reduce((sum: number, r: any) => sum + (r.record_balance || 0), 0);

        content = `
            <table>
                <thead>
                    <tr>
                        <th>Date Out</th>
                        <th>Ref #</th>
                        <th>Customer</th>
                        <th style="text-align: right">Bags</th>
                        <th style="text-align: right">Rent Billed</th>
                        <th style="text-align: right">Paid (Record)</th>
                        <th style="text-align: right">Balance (Record)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                    <tr style="font-weight: bold; background-color: #f0f0f0;">
                        <td colspan="4" style="text-align: right;">Totals:</td>
                        <td style="text-align: right;">${formatCurrency(totalRent)}</td>
                        <td style="text-align: right;">${formatCurrency(totalPaid)}</td>
                        <td style="text-align: right;">${formatCurrency(totalBalance)}</td>
                    </tr>
                </tbody>
            </table>
            <p style="font-size: 11px; color: #6b7280; margin-top: 8px;">
                Note: "Paid (Record)" and "Balance (Record)" reflect the total payment status
                of the parent storage record, not individual withdrawal transactions.
            </p>
        `;
    }

    // 6. Payment Register
    else if (reportType === 'payment-register') {
        const dateRange = formatDateRange(data.period);
        title = `Payment Register ${dateRange}`;
        const rows = data.data.map((p: any) => `
            <tr>
                <td>${new Date(p.payment_date).toLocaleDateString()}</td>
                <td>${p.storage_records?.record_number || p.storage_records?.id?.substring(0, 8) || '-'}</td>
                <td>${p.storage_records?.customers?.name || p.customers?.name || 'Unknown'}</td>
                <td>${p.payment_mode || 'Cash'}</td>
                <td>${p.type || 'Other'}</td>
                <td>${p.notes || '-'}</td>
                <td style="text-align: right">${formatCurrency(p.amount)}</td>
            </tr>
        `).join('');
        
        const totalCollected = data.data.reduce((sum: number, p: any) => sum + p.amount, 0);

        content = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Ref #</th>
                        <th>Customer</th>
                        <th>Mode</th>
                        <th>Type</th>
                        <th>Notes</th>
                        <th style="text-align: right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                    <tr style="font-weight: bold; background-color: #f0f0f0;">
                        <td colspan="6" style="text-align: right;">Total Collected:</td>
                        <td style="text-align: right;">${formatCurrency(totalCollected)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    // 7. All Customers List
    else if (reportType === 'all-customers') {
        title = 'All Customers List';
        const rows = data.data.map((c: any, index: number) => {
            const statusColor = c.paymentStatus === 'paid' ? '#27ae60' : 
                               c.paymentStatus === 'partial' ? '#f39c12' : '#e74c3c';
            const statusBadge = `<span style="color: ${statusColor}; font-weight: bold;">${c.paymentStatus.toUpperCase()}</span>`;
            const lastActivity = c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : 'N/A';
            
            return `
            <tr>
                <td>${index + 1}</td>
                <td>${c.name}</td>
                <td>${c.phone || '-'}</td>
                <td>${c.village || '-'}</td>
                <td style="text-align: right">${c.totalBagsIn || 0}</td>
                <td style="text-align: right">${c.totalBagsOut || 0}</td>
                <td style="text-align: right; font-weight: bold;">${c.balanceStock || 0}</td>
                <td style="text-align: right">${c.activeBags || 0}</td>
                <td style="text-align: right">${formatCurrency(c.outstanding || 0)}</td>
                <td>${statusBadge}</td>
                <td style="font-size: 10px;">${lastActivity}</td>
            </tr>
        `}).join('');
        
        const totalBagsIn = data.data.reduce((sum: number, c: any) => sum + (c.totalBagsIn || 0), 0);
        const totalBagsOut = data.data.reduce((sum: number, c: any) => sum + (c.totalBagsOut || 0), 0);
        const totalBalance = data.data.reduce((sum: number, c: any) => sum + (c.balanceStock || 0), 0);
        const totalActive = data.data.reduce((sum: number, c: any) => sum + (c.activeBags || 0), 0);
        const totalOutstanding = data.data.reduce((sum: number, c: any) => sum + (c.outstanding || 0), 0);
        
        content = `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; font-size: 12px;">
                    <div>
                        <strong>Total Customers:</strong> ${data.data.length}
                    </div>
                    <div>
                        <strong>Total Bags In:</strong> ${totalBagsIn}
                    </div>
                    <div>
                        <strong>Total Bags Out:</strong> ${totalBagsOut}
                    </div>
                    <div>
                        <strong>Balance Stock:</strong> <span style="font-weight: bold; color: #2980b9;">${totalBalance}</span>
                    </div>
                    <div>
                        <strong>Active Stock:</strong> ${totalActive}
                    </div>
                    <div>
                        <strong>Total Outstanding:</strong> <span style="font-weight: bold; color: #e74c3c;">₹${formatCurrency(totalOutstanding)}</span>
                    </div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Village</th>
                        <th style="text-align: right">Bags In</th>
                        <th style="text-align: right">Bags Out</th>
                        <th style="text-align: right">Balance</th>
                        <th style="text-align: right">Active</th>
                        <th style="text-align: right">Outstanding</th>
                        <th>Status</th>
                        <th>Last Activity</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    // 7. Pending Dues List
    else if (reportType === 'pending-dues') {
        title = 'Pending Dues List';
        const rows = data.data.map((c: any, index: number) => `
            <tr>
                <td>${index + 1}</td>
                <td>${c.name}</td>
                <td>${c.phone || '-'}</td>
                <td style="text-align: right">${formatCurrency(c.totalDues)}</td>
                <td style="text-align: right">${formatCurrency(c.totalPaid)}</td>
                <td style="text-align: right; color: #e74c3c; font-weight: bold;">${formatCurrency(c.balance)}</td>
            </tr>
        `).join('');
        
        const totalOutstanding = data.data.reduce((sum: number, c: any) => sum + c.balance, 0);

        content = `
            <table>
                <thead>
                    <tr>
                        <th style="width: 5%">#</th>
                        <th style="width: 25%">Customer</th>
                        <th style="width: 15%">Phone</th>
                        <th style="width: 15%; text-align: right">Billed</th>
                        <th style="width: 15%; text-align: right">Paid</th>
                        <th style="width: 15%; text-align: right">Balance Due</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                    <tr style="font-weight: bold; background-color: #f0f0f0;">
                        <td colspan="5" style="text-align: right;">Total Outstanding:</td>
                        <td style="text-align: right; color: #e74c3c;">${formatCurrency(totalOutstanding)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    // 8. Lot Inventory Report
    else if (reportType === 'lot-inventory') {
        title = 'Lot Inventory Report';
        let currentLot = '';
        const rows = data.data.map((r: any) => {
            const showLot = r.lot_name !== currentLot;
            if (showLot) currentLot = r.lot_name;
            
            return `
                <tr>
                    <td style="${showLot ? 'font-weight: bold; border-top: 2px solid #ddd;' : 'border-top: none; color: transparent;'}">${r.lot_name}</td>
                    <td>${r.customer_name}</td>
                    <td>${r.crop_name}</td>
                    <td style="text-align: right">${r.total_bags}</td>
                </tr>
            `;
        }).join('');

        const totalBags = data.data.reduce((sum: number, r: any) => sum + r.total_bags, 0);

        content = `
            <table>
                <thead>
                    <tr>
                        <th style="width: 15%">Lot</th>
                        <th style="width: 35%">Customer</th>
                        <th style="width: 30%">Commodity</th>
                        <th style="width: 20%; text-align: right">Bags stored</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                    <tr style="font-weight: bold; background-color: #f0f0f0;">
                        <td colspan="3" style="text-align: right;">Total Bags in Warehouse:</td>
                        <td style="text-align: right;">${totalBags}</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                @media print {
                    @page { margin: 1cm; }
                    body { margin: 0; }
                    .no-print { display: none; }
                }
                
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    max-width: 210mm;
                    margin: 0 auto;
                    color: #333;
                }
                
                .header {
                    margin-bottom: 30px;
                    border-bottom: 2px solid #3498db;
                    padding-bottom: 15px;
                }
                
                .header h1 { margin: 0; font-size: 22px; color: #2c3e50; }
                .header h3 { margin: 5px 0 0; font-size: 16px; color: #7f8c8d; font-weight: normal; }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                
                th {
                    background-color: #3498db;
                    color: white;
                    padding: 8px;
                    text-align: left;
                }
                
                td {
                    padding: 6px 8px;
                    border-bottom: 1px solid #ddd;
                }
                
                tr:nth-child(even) { background-color: #f9f9f9; }
                
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 10px;
                    color: #bdc3c7;
                }
                
                .no-print {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                }
                
                button {
                    padding: 10px 20px;
                    font-size: 14px;
                    cursor: pointer;
                    border: none;
                    border-radius: 4px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }
            </style>
        </head>
        <body>
            <div class="no-print">
                <button onclick="window.print()" style="background: #3498db; color: white; margin-right: 10px;">Print PDF</button>
                <button onclick="window.close()" style="background: #e74c3c; color: white;">Close</button>
            </div>
            
            <div class="header">
                <h1>${warehouseName}</h1>
                <h3>${title}</h3>
                <div style="font-size: 11px; color: #95a5a6; margin-top: 5px;">Generated: ${new Date().toLocaleString()}</div>
            </div>
            
            ${content}
            
            <div class="footer">
                Page 1 of 1 (approx) - Computer Generated Report
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
    }
}

/**
 * Export Custom Report to Excel
 */
export function exportCustomReportToExcel(
    reportType: string,
    data: any,
    format: ExportFormat = 'excel',
) {
    let exportData: any[] = [];
    let filename = '';

    if (reportType === 'all-customers') {
        filename = 'all-customers';
        exportData = data.data.map((c: any, index: number) => ({
            '#': index + 1,
            'Customer ID': c.customer_number ?? c.customerNumber ?? '',
            'Name': c.name,
            'Phone': c.phone,
            'Village': c.village || '-',
            'Join Date': c.entry_date ? new Date(c.entry_date).toLocaleDateString() : '-',
            'Active Bags': c.activeBags || 0,
            'Outstanding': c.outstanding || 0
        }));
    } else if (reportType === 'active-inventory') {
        filename = 'active-inventory';
        exportData = data.data.map((r: any) => ({
            'Storage ID': r.record_number ?? '',
            'Customer ID': r.customers?.customer_number ?? '',
            'Date In': new Date(r.storage_start_date).toLocaleDateString(),
            'Customer': r.customers?.name || 'Unknown',
            'Commodity': r.commodity_description,
            'Location': r.location,
            'Bags': r.bags_stored
        }));
    } else if (reportType === 'transaction-history') {
        filename = 'transaction-history';
        exportData = data.data.map((r: any) => ({
            'Storage ID': r.record_number ?? '',
            'Customer ID': r.customers?.customer_number ?? '',
            'Date In': new Date(r.storage_start_date).toLocaleDateString(),
            'Date Out': r.storage_end_date ? new Date(r.storage_end_date).toLocaleDateString() : '-',
            'Customer': r.customers?.name || 'Unknown',
            'Commodity': r.commodity_description,
            'Bags': r.bags_stored,
            'Status': r.storage_end_date ? 'Completed' : 'Active'
        }));
    } else if (reportType === 'inflow-register') {
        filename = 'inflow-register';
        exportData = data.data.map((r: any) => ({
            'Storage ID': r.record_number ?? '',
            'Customer ID': r.customers?.customer_number ?? '',
            'Date': new Date(r.storage_start_date).toLocaleDateString(),
            'Customer': r.customers?.name || 'Unknown',
            'Commodity': r.commodity_description,
            'Bags In': r.bags_in || r.bags_stored
        }));
    } else if (reportType === 'outflow-register') {
        filename = 'outflow-register';
        exportData = data.data.map((r: any) => ({
            'Withdrawal ID': r.withdrawal_number ?? '',
            'Storage ID': r.record_number ?? '',
            'Customer ID': r.customers?.customer_number ?? '',
            'Date Out': new Date(r.storage_end_date).toLocaleDateString(),
            'Customer': r.customers?.name || 'Unknown',
            'Bags': r.bags_stored,
            'Rent': r.total_rent_billed || 0,
            'Record Billed': r.record_total_billed || 0,
            'Record Paid': r.record_total_paid || 0,
            'Record Balance': r.record_balance || 0,
        }));
    } else if (reportType === 'payment-register') {
        filename = 'payment-register';
        exportData = data.data.map((p: any) => ({
            'Payment ID': p.payment_number ?? '',
            'Storage ID': p.storage_records?.record_number ?? '',
            'Customer ID': p.storage_records?.customers?.customer_number ?? p.customers?.customer_number ?? '',
            'Date': new Date(p.payment_date).toLocaleDateString(),
            'Customer': p.storage_records?.customers?.name || p.customers?.name || 'Unknown',
            'Payment Mode': p.payment_mode || 'Cash',
            'Payment Type': p.type || 'Other',
            'Notes': p.notes || '-',
            'Amount': p.amount
        }));
    } else if (reportType === 'customer-dues-details') {
        filename = `customer-dues-${data.customer.name.replace(/\s/g, '-').toLowerCase()}`;
        const isHamaliOnly = data.duesType === 'hamali';

        exportData = data.data.map((r: any) => {
            const dateRange = r.endDate
                ? `${new Date(r.date).toLocaleDateString()} to ${new Date(r.endDate).toLocaleDateString()}`
                : `${new Date(r.date).toLocaleDateString()} to Active`;

            const record: any = {
                'Storage ID': r.recordNumber ?? '',
                'Storage Period': dateRange,
                'Commodity': r.commodity,
                'Bags': r.bags,
                'Status': r.status,
                'Hamali Due': r.hamaliDue,
                'Insurance Due': r.insuranceDue || 0,
            };

            // Only add Rent columns if not Hamali-only view
            if (!isHamaliOnly) {
                record['Rent Due'] = r.rentDue;
            }

            record['Paid'] = r.hamaliPaid + r.rentPaid + (r.insurancePaid || 0);
            record['Balance'] = r.totalBalance;

            return record;
        });
    } else if (reportType === 'pending-dues') {
        filename = 'pending-dues';
        exportData = data.data.map((c: any) => ({
            'Customer ID': c.customer_number ?? c.customerNumber ?? '',
            'Customer': c.name,
            'Phone': c.phone,
            'Billed Total': c.totalDues,
            'Paid Total': c.totalPaid,
            'Balance Due': c.balance
        }));
    } else if (reportType === 'lot-inventory') {
        filename = 'lot-inventory';
        exportData = data.data.map((r: any) => ({
            'Lot': r.lot_name,
            'Customer': r.customer_name,
            'Commodity': r.crop_name,
            'Bags stored': r.total_bags
        }));
    }

    // Customer Dues Statement gets a richer multi-sheet workbook in Excel
    // mode: one sheet of per-record summary (existing), plus a chronological
    // transactions ledger with bulk batches as parent rows + nested per-record
    // detail rows so the customer can see exactly what happened on each day.
    if (reportType === 'customer-dues-details' && format === 'excel' && data.transactions) {
        return exportCustomerDuesMultiSheet({
            filename,
            recordRows: exportData,
            transactions: data.transactions,
            customerName: data.customer?.name || 'Customer',
            summary: data.summary,
        });
    }

    return dispatchExport(exportData, filename, 'Report Data', format);
}

/**
 * Multi-sheet Excel export for Customer Dues Statement.
 *
 * Sheet 1 "Records Summary": one row per storage record (per-record dues view).
 * Sheet 2 "Daily Transactions": chronological ledger. For each bulk batch:
 *   - one parent row showing date, bill #, total bags, total rent
 *   - immediately followed by indented child rows, one per record slice
 *     (record #, bags taken, slice rent), grouped in Excel via outlineLevel
 *     so the customer can collapse/expand each batch in the spreadsheet.
 * Single (non-batch) outflows render as one row each.
 */
async function exportCustomerDuesMultiSheet(opts: {
    filename: string;
    recordRows: any[];
    transactions: any[];
    customerName: string;
    summary?: any;
}) {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();

    // --- Sheet 1: per-record summary ---
    if (opts.recordRows.length > 0) {
        const ws1 = wb.addWorksheet('Records Summary');
        const headers = Object.keys(opts.recordRows[0]);
        ws1.columns = headers.map(h => ({ header: h, key: h, width: 18 }));
        opts.recordRows.forEach(r => ws1.addRow(r));
        ws1.getRow(1).font = { bold: true };
        ws1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
    }

    // --- Sheet 2: chronological ledger with batch grouping ---
    const ws2 = wb.addWorksheet('Daily Transactions');
    ws2.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Type', key: 'type', width: 14 },
        { header: 'Description', key: 'description', width: 50 },
        { header: 'Bill / Record #', key: 'invoiceNo', width: 18 },
        { header: 'Bags In', key: 'bagsIn', width: 10 },
        { header: 'Bags Out', key: 'bagsOut', width: 10 },
        { header: 'Hamali (₹)', key: 'hamali', width: 14 },
        { header: 'Insurance (₹)', key: 'insurance', width: 14 },
        { header: 'Rent (₹)', key: 'rent', width: 14 },
        { header: 'Paid (₹)', key: 'credit', width: 14 },
        { header: 'Balance (₹)', key: 'balance', width: 14 },
    ];
    const headerRow = ws2.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };

    // Sort chronologically
    const sorted = [...opts.transactions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const t of sorted) {
        const dateStr = new Date(t.date).toLocaleDateString();
        const parent = ws2.addRow({
            date: dateStr,
            type: t.type.toUpperCase(),
            description: t.description,
            invoiceNo: t.invoiceNo,
            bagsIn: t.bagsIn ?? '',
            bagsOut: t.bagsOut ?? '',
            hamali: t.hamali ?? '',
            insurance: t.insurance ?? '',
            rent: t.rent ?? '',
            credit: t.credit ?? '',
            balance: t.balance ?? '',
        });

        if (t.isBulkBatch && Array.isArray(t.slices) && t.slices.length > 0) {
            // Style the batch parent row distinctively
            parent.font = { bold: true };
            parent.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };

            // Indented child rows, collapsible group
            for (const sl of t.slices) {
                const child = ws2.addRow({
                    date: '',
                    type: '  ↳ slice',
                    description: `   Record #${sl.recordNumber ?? '—'}`,
                    invoiceNo: '',
                    bagsIn: '',
                    bagsOut: sl.bagsOut,
                    hamali: '',
                    insurance: '',
                    rent: sl.rent,
                    credit: '',
                    balance: '',
                });
                child.outlineLevel = 1;
                child.font = { color: { argb: 'FF555555' }, italic: true };
            }
        } else if (t.type === 'outflow') {
            parent.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
        } else if (t.type === 'inflow') {
            parent.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        } else if (t.type === 'payment') {
            parent.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };
        }
    }

    // Summary footer
    if (opts.summary) {
        ws2.addRow({});
        const tot = ws2.addRow({
            date: '',
            type: 'TOTALS',
            description: '',
            invoiceNo: '',
            bagsIn: opts.summary.totalBagsIn,
            bagsOut: opts.summary.totalBagsOut,
            hamali: opts.summary.totalHamali,
            insurance: opts.summary.totalInsurance,
            rent: opts.summary.totalRent,
            credit: opts.summary.totalPaid,
            balance: opts.summary.balanceDue,
        });
        tot.font = { bold: true };
        tot.border = { top: { style: 'thick' } };
    }

    // Freeze headers + enable outline summary above for both sheets
    ws2.views = [{ state: 'frozen', ySplit: 1 }];
    ws2.properties.outlineProperties = { summaryBelow: false, summaryRight: false };
    if (opts.recordRows.length > 0) {
        wb.getWorksheet('Records Summary')!.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${opts.filename}-${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
}


/**
 * Format Date Range Helper
 */
function formatDateRange(period?: { startDate?: string, endDate?: string }) {
    if (!period?.startDate && !period?.endDate) return '(All Time)';
    const start = period.startDate ? new Date(period.startDate).toLocaleDateString() : '...';
    const end = period.endDate ? new Date(period.endDate).toLocaleDateString() : '...';
    return `(${start} - ${end})`;
}

/**
 * Generates a generic Tally XML for Sales Vouchers (Invoices)
 * This is a simplified format compatible with Tally generic import
 */
export const generateTallyXML = (records: any[]) => {
  let xml = `<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
                <STATICVARIABLES>
                    <SVCURRENTCOMPANY>Company Name</SVCURRENTCOMPANY>
                </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>`;

  records.forEach((record: any) => {
    // Basic mapping
    const dateStr = record.date ? format(new Date(record.date), 'yyyyMMdd') : format(new Date(), 'yyyyMMdd');
    
    xml += `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${dateStr}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(record.invoiceNo || 'Auto')}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${escapeXml(record.customerName || 'Cash')}</PARTYLEDGERNAME>
            <EFFECTIVEDATE>${dateStr}</EFFECTIVEDATE>
            <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${escapeXml(record.customerName || 'Cash')}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-${record.amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>Storage Rent</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${record.amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
    </TALLYMESSAGE>`;
  });

  xml += `
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>`;

  return xml;
};

// Helper to download text files (CSV, XML)
export const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

function escapeXml(unsafe: string) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

