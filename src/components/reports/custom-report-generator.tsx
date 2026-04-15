'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Loader2, FileSpreadsheet, CalendarRange, Download, Package } from 'lucide-react';
import { fetchReportData, fetchReportCount } from '@/lib/report-actions';
import { generateCustomReportPDF, exportCustomReportToExcel } from '@/lib/export-utils';
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from '@/hooks/use-toast';
import { useCustomers } from '@/contexts/customer-context';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface CustomReportGeneratorProps {
    warehouseName: string;
    allowExport: boolean;
}

export function CustomReportGenerator({ warehouseName, allowExport }: CustomReportGeneratorProps) {
    const [reportType, setReportType] = useState('all-customers');
    const [format, setFormat] = useState('pdf');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [includeHistory, setIncludeHistory] = useState<boolean>(false);
    const [duesType, setDuesType] = useState<'all' | 'hamali'>('all');
    const [downloadAll, setDownloadAll] = useState<boolean>(false);
    const [recordCount, setRecordCount] = useState<{ count: number; totalQuantity: number; quantityLabel: string } | null>(null);
    const [isCountLoading, setIsCountLoading] = useState(false);
    const { customers } = useCustomers();

    const isDateRangeReport = [
        'inflow-register',
        'outflow-register',
        'payment-register'
    ].includes(reportType);

    const isDateRangeRequired = isDateRangeReport && !downloadAll;

    const isCustomerRequired = reportType === 'customer-dues-details';

    // Fetch record count preview whenever filters change
    const loadCount = useCallback(async () => {
        if (!allowExport) return;
        // For date-range reports with the toggle OFF, require both dates
        if (isDateRangeReport && !downloadAll && (!startDate || !endDate)) {
            setRecordCount(null);
            return;
        }
        setIsCountLoading(true);
        try {
            const result = await fetchReportCount(reportType, {
                startDate: (isDateRangeReport && downloadAll) ? undefined : (startDate || undefined),
                endDate: (isDateRangeReport && downloadAll) ? undefined : (endDate || undefined),
            });
            setRecordCount(result);
        } catch {
            setRecordCount(null);
        } finally {
            setIsCountLoading(false);
        }
    }, [reportType, startDate, endDate, downloadAll, isDateRangeReport, allowExport]);

    useEffect(() => {
        // Debounce the count fetch slightly
        const timer = setTimeout(loadCount, 300);
        return () => clearTimeout(timer);
    }, [loadCount]);

    const handleGenerate = async () => {
        if (!allowExport) {
            toast({
                title: "Upgrade Required",
                description: "Custom reports are available on higher tier plans.",
                variant: "destructive"
            });
            return;
        }

        if (isDateRangeRequired && (!startDate || !endDate)) {
            toast({
                title: "Dates Required",
                description: "Please select both start and end dates for this report.",
                variant: "destructive"
            });
            return;
        }

        if (isCustomerRequired && !selectedCustomerId) {
            toast({
                title: "Customer Required",
                description: "Please select a customer.",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);
        try {
            // 1. Fetch Data — skip dates when downloading all records
            const data = await fetchReportData(reportType, {
                startDate: (isDateRangeReport && downloadAll) ? undefined : (startDate || undefined),
                endDate: (isDateRangeReport && downloadAll) ? undefined : (endDate || undefined),
                customerId: selectedCustomerId || undefined,
                includeHistory: includeHistory,
                duesType: duesType
            });
            
            if (!data) {
                toast({
                    title: "Error",
                    description: "Failed to fetch report data",
                    variant: "destructive",
                });
                return;
            }

            // 2. Generate Export
            const recordsExported = Array.isArray(data.data) ? data.data.length : 0;
            const countSuffix = recordsExported > 0 ? ` (${recordsExported.toLocaleString()} records)` : '';

            if (format === 'pdf') {
                generateCustomReportPDF(reportType, data, warehouseName);
                toast({
                    title: "Success",
                    description: `PDF generated successfully${countSuffix}`,
                });
            } else {
                exportCustomReportToExcel(reportType, data);
                toast({
                    title: "Success",
                    description: `Excel generated successfully${countSuffix}`,
                });
            }
        } catch (error) {
            console.error('Report generation error:', error);
            toast({
                title: "Error",
                description: "Failed to generate report",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Custom Report Generator</CardTitle>
                <CardDescription>
                    Select the report type and format to generate a detailed analysis.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {!allowExport && (
                   <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md p-4 text-sm mb-4">
                        Custom Reports are locked. Please upgrade your plan to generate detailed reports.
                   </div>
                )}
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${!allowExport ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="space-y-2 col-span-2 md:col-span-2">
                        <Label>Report Type</Label>
                        <Select value={reportType} onValueChange={(val) => { setReportType(val); setDownloadAll(false); }}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all-customers">All Customers List</SelectItem>
                                <SelectItem value="customer-dues-details">Customer Dues Statement (Detailed)</SelectItem>
                                <SelectItem value="active-inventory">Active Inventory (Stock)</SelectItem>
                                <SelectItem value="pending-dues">Pending Dues List</SelectItem>
                                <SelectItem value="inflow-register">Inflow Register (Date Range)</SelectItem>
                                <SelectItem value="outflow-register">Outflow Register (Date Range)</SelectItem>
                                <SelectItem value="payment-register">Payment Register (Date Range)</SelectItem>
                                <SelectItem value="lot-inventory">Lot Inventory (Patti mapping)</SelectItem>
                                <SelectItem value="transaction-history">Recent Transactions (Last 1000)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                            {reportType === 'all-customers' && 'List of all registered customers with their active bag counts.'}
                            {reportType === 'customer-dues-details' && 'Detailed breakdown of Rent and Hamali dues for a specific customer.'}
                            {reportType === 'active-inventory' && 'Detailed list of currently stored items in the warehouse.'}
                            {reportType === 'pending-dues' && 'List of customers with outstanding balances.'}
                            {reportType === 'inflow-register' && 'Log of items received during the selected period.'}
                            {reportType === 'outflow-register' && 'Log of items withdrawn during the selected period.'}
                            {reportType === 'payment-register' && 'Log of payments received during the selected period.'}
                            {reportType === 'lot-inventory' && 'Mapping of lots to customers and items currently in stock.'}
                            {reportType === 'transaction-history' && 'Log of recent inflows and outflows (last 1000 records).'}
                        </p>
                    </div>

                    {isCustomerRequired && (
                        <div className="space-y-4 col-span-2">
                            <div className="space-y-2">
                                <Label>Select Customer</Label>
                                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Search or select a customer..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                        {customers.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-3 p-3 border rounded-md">
                                    <Label>Dues To Show</Label>
                                    <RadioGroup value={duesType} onValueChange={(v) => setDuesType(v as 'all' | 'hamali')}>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="all" id="r-all" />
                                            <Label htmlFor="r-all">All (Rent + Hamali)</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="hamali" id="r-hamali" />
                                            <Label htmlFor="r-hamali">Hamali Only</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                                <div className="flex items-center space-x-2 p-3 border rounded-md">
                                    <Checkbox 
                                        id="include-history" 
                                        checked={includeHistory} 
                                        onCheckedChange={(checked) => setIncludeHistory(checked as boolean)} 
                                    />
                                    <Label htmlFor="include-history" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        Include Settled & Closed Records
                                    </Label>
                                </div>
                            </div>
                        </div>
                    )}

                    {isDateRangeReport && (
                        <>
                            <div className="col-span-2 flex items-center justify-between p-3 border rounded-md bg-muted/30">
                                <div className="flex items-center gap-2">
                                    {downloadAll ? (
                                        <Download className="h-4 w-4 text-primary" />
                                    ) : (
                                        <CalendarRange className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <div>
                                        <Label htmlFor="download-all" className="text-sm font-medium cursor-pointer">
                                            {downloadAll ? 'Download All Records' : 'Filter by Date Range'}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            {downloadAll
                                                ? 'Export every record — no date filter applied.'
                                                : 'Select a date range to filter records.'}
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    id="download-all"
                                    checked={downloadAll}
                                    onCheckedChange={setDownloadAll}
                                />
                            </div>
                            {!downloadAll && (
                                <>
                                    <div className="space-y-2">
                                        <Label>From Date</Label>
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>To Date</Label>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* Record count + quantity preview */}
                    {recordCount !== null && (
                        <div className="col-span-2 flex items-center gap-3 p-3 border rounded-md bg-blue-50/60 dark:bg-blue-950/20">
                            <Package className="h-5 w-5 text-blue-600 shrink-0" />
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="text-sm font-semibold">
                                    {recordCount.count.toLocaleString()} records
                                </Badge>
                                {recordCount.totalQuantity > 0 && (
                                    <span className="text-sm text-muted-foreground">
                                        &bull; {recordCount.quantityLabel === 'total amount (₹)'
                                            ? `₹${recordCount.totalQuantity.toLocaleString()}`
                                            : recordCount.totalQuantity.toLocaleString()}{' '}
                                        {recordCount.quantityLabel !== 'total amount (₹)' && recordCount.quantityLabel}
                                    </span>
                                )}
                            </div>
                            {isCountLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
                        </div>
                    )}
                    {isCountLoading && recordCount === null && (
                        <div className="col-span-2 flex items-center gap-2 p-3 text-sm text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Counting records...
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Export Format</Label>
                        <Select value={format} onValueChange={setFormat}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pdf">PDF Document</SelectItem>
                                <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <Button 
                        onClick={handleGenerate} 
                        disabled={isLoading || !allowExport}
                        className="w-full md:w-auto min-w-[200px]"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                {format === 'pdf' ? <FileText className="mr-2 h-4 w-4" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                                Generate Report
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
