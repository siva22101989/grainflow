import { StorageRecord } from './definitions';
import { exportToPdfWithFilters } from './export-pdf-utils';
import type { ExportFormat } from './export-utils';

export interface ExportMetadata {
  totalRecords: number;
  filteredRecords: number;
  appliedFilters: { label: string; value: string }[];
  exportDate: Date;
  exportedBy?: string;
}

async function dispatchFiltered<T extends Record<string, any>>(
  data: T[],
  filename: string,
  metadata: ExportMetadata,
  sheetName: string,
  format: ExportFormat,
) {
  if (format === 'pdf') return exportToPdfWithFilters(data, filename, metadata, sheetName);
  return exportToExcelWithFilters(data, filename, metadata, sheetName);
}

/**
 * Enhanced Excel Export with Filter Metadata
 */
export async function exportToExcelWithFilters<T extends Record<string, any>>(
  data: T[],
  filename: string,
  metadata: ExportMetadata,
  sheetName: string = 'Data'
) {
  // Dynamic import ExcelJS
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  // 1. Create Metadata Sheet
  const metadataWs = workbook.addWorksheet('Summary');
  
  // Add metadata rows
  metadataWs.addRow(['Export Summary']);
  metadataWs.addRow(['Total Records', metadata.totalRecords]);
  metadataWs.addRow(['Filtered Records', metadata.filteredRecords]);
  metadataWs.addRow(['Export Date', metadata.exportDate.toLocaleString()]);
  metadataWs.addRow([]);
  metadataWs.addRow(['Applied Filters:']);
  metadata.appliedFilters.forEach(f => {
    metadataWs.addRow([f.label, f.value]);
  });

  // Set column widths
  metadataWs.getColumn(1).width = 20;
  metadataWs.getColumn(2).width = 40;

  // 2. Create Data Sheet
  const dataWs = workbook.addWorksheet(sheetName);
  if (data.length > 0) {
    const headers = Object.keys(data[0]!);
    dataWs.columns = headers.map(header => ({
      header,
      key: header,
      width: 15
    }));
    data.forEach(row => dataWs.addRow(row));
  }

  // 3. Generate File and Download
  const buffer = await workbook.xlsx.writeBuffer();
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
 * Export specific helpers
 */

// Storage Records
export function exportStorageRecordsWithFilters(
  records: StorageRecord[],
  metadata: ExportMetadata,
  format: ExportFormat = 'excel',
) {
  const data = records.map(r => ({
    'Record Number': r.recordNumber || r.id.substring(0, 8),
    'Date': new Date(r.storageStartDate).toLocaleDateString(),
    'Customer': r.customerName || 'Unknown',
    'Commodity': r.commodityDescription || '-',
    'Location': r.location || '-',
    'Bags Stored': r.bagsStored,
    'Hamali Payable': r.hamaliPayable || 0,
    'Insurance Payable': r.insurancePayable || 0,
    'Rent Billed': r.totalRentBilled || 0,
    'Status': r.storageEndDate ? 'Completed' : 'Active',
    'End Date': r.storageEndDate ? new Date(r.storageEndDate).toLocaleDateString() : '-'
  }));

  return dispatchFiltered(data, 'filtered-storage-records', metadata, 'Storage Records', format);
}

// Inflow Records (Unloading)
export function exportInflowRecordsWithFilters(
  records: any[],
  metadata: ExportMetadata,
  format: ExportFormat = 'excel',
) {
    const data = records.map(r => ({
        'Date': r.unload_date ? new Date(r.unload_date).toLocaleDateString() : '-',
        'Customer': r.customer?.name || 'Unknown',
        'Commodity': r.commodity_description,
        'Lorry No': r.lorry_tractor_no || '-',
        'Bags Unloaded': r.bags_unloaded,
        'Hamali Amount': r.hamali_amount || 0,
        'Notes': r.notes || '-'
    }));
    return dispatchFiltered(data, 'filtered-inflow-records', metadata, 'Inflow', format);
}

// Outflow Records (Loading)
export function exportOutflowRecordsWithFilters(
  records: any[],
  metadata: ExportMetadata,
  format: ExportFormat = 'excel',
) {
    const data = records.map(r => ({
        'Date': r.created_at ? new Date(r.created_at).toLocaleDateString() : '-',
        'Transaction ID': r.transaction_number || r.id.substring(0, 8),
        'Customer': r.customer?.name || 'Unknown',
        'Bags Out': r.quantity,
        'Type': r.transaction_type,
        'Status': r.status,
        'Notes': r.notes || '-'
    }));
    return dispatchFiltered(data, 'filtered-outflow-records', metadata, 'Outflow', format);
}

// Expenses
export function exportExpensesWithFilters(
  expenses: any[],
  metadata: ExportMetadata,
  format: ExportFormat = 'excel',
) {
    const data = expenses.map(e => ({
        'Date': new Date(e.date).toLocaleDateString(),
        'Description': e.description,
        'Amount': e.amount,
        'Category': e.category,
        'Payment Mode': e.payment_mode
    }));
    return dispatchFiltered(data, 'filtered-expenses', metadata, 'Expenses', format);
}

// Customers
export function exportCustomersWithFilters(
  customers: any[],
  metadata: ExportMetadata,
  format: ExportFormat = 'excel',
) {
    const data = customers.map(c => ({
        'Name': c.name,
        'Phone': c.phone,
        'Email': c.email || '-',
        'Village': c.village || '-',
        'Balance': c.balance || 0,
        'Active Records': c.active_records_count || 0
    }));
    return dispatchFiltered(data, 'filtered-customers', metadata, 'Customers', format);
}
