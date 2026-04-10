
'use client';

import { useState, useMemo } from 'react';
import { usePagination } from '@/hooks/use-pagination';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { 
    Package, 
    CreditCard, 
    Calendar, 
    MapPin, 
    Phone, 
    User,
    ArrowDownToDot,
    ArrowUpFromDot,
    PlusCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CustomerStatementButton } from '@/components/customers/customer-statement-button';
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EditCustomerDialog } from '@/components/customers/edit-customer-dialog';
import { DeleteCustomerButton } from '@/components/customers/delete-customer-button';
import { EditPaymentDialog } from '@/components/payments/edit-payment-dialog';
import { DeletePaymentButton } from '@/components/payments/delete-payment-button';
import { AddPaymentDialog } from '@/components/payments/add-payment-dialog';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import type { Customer, StorageRecord } from '@/lib/definitions';
import { BulkOutflowDialog } from '@/components/customers/bulk-outflow-dialog';
import { PaymentLinkDialog } from './payment-link-dialog';

interface CustomerDetailsClientProps {
    customer: Customer;
    initialRecords: StorageRecord[];
}

export function CustomerDetailsClient({ customer, initialRecords }: CustomerDetailsClientProps) {
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    
    // Pagination for each tab
    const activePagination = usePagination(10);
    const [activePage, setActivePage] = useState(1);
    
    const paymentsPagination = usePagination(20);
    const [paymentsPage, setPaymentsPage] = useState(1);
    
    const historyPagination = usePagination(10);
    const [historyPage, setHistoryPage] = useState(1);

    // --- Filtering Logic ---
    const filteredRecords = useMemo(() => {
        if (!dateRange?.from) return initialRecords;

        const start = startOfDay(dateRange.from);
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

        return initialRecords.filter(record => {
             const recordDate = new Date(record.storageStartDate);
             // 1. Record started in range
             if (isWithinInterval(recordDate, { start, end })) return true;
             
             // 2. Record ended in range (for history)
             if (record.storageEndDate) {
                 const endDate = new Date(record.storageEndDate);
                 if (isWithinInterval(endDate, { start, end })) return true;
             }

             // 3. Has payment in range
             const hasPaymentInRange = record.payments?.some(p => 
                isWithinInterval(new Date(p.date), { start, end })
             );
             if (hasPaymentInRange) return true;

             return false;
        });
    }, [initialRecords, dateRange]);

    // Derived Lists based on FILTERED records
    const activeRecords = filteredRecords.filter(r => !r.storageEndDate);
    const historyRecords = filteredRecords.filter(r => r.storageEndDate || r.bagsOut > 0);
    
    // Paginated active records
    const activeStartIndex = (activePage - 1) * activePagination.pageSize;
    const activeEndIndex = activeStartIndex + activePagination.pageSize;
    const paginatedActiveRecords = activeRecords.slice(activeStartIndex, activeEndIndex);
    const activeTotalPages = Math.ceil(activeRecords.length / activePagination.pageSize);
    
    // Paginated history records
    const historyStartIndex = (historyPage - 1) * historyPagination.pageSize;
    const historyEndIndex = historyStartIndex + historyPagination.pageSize;
    const paginatedHistoryRecords = historyRecords.slice(historyStartIndex, historyEndIndex);
    const historyTotalPages = Math.ceil(historyRecords.length / historyPagination.pageSize);
    
    // Paginated payments
    const allPayments = filteredRecords.flatMap(r => 
        (r.payments || [])
        .filter(p => {
            if (!dateRange?.from) return true;
            const start = startOfDay(dateRange.from);
            const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            return isWithinInterval(new Date(p.date), { start, end });
        })
        .map((p: any, idx: number) => ({
            ...p,
            recordId: r.id,
            recordNumber: r.recordNumber,
            paymentId: `${r.id}-${idx}`
        }))
    );
    const paymentsStartIndex = (paymentsPage - 1) * paymentsPagination.pageSize;
    const paymentsEndIndex = paymentsStartIndex + paymentsPagination.pageSize;
    const paginatedPayments = allPayments.slice(paymentsStartIndex, paymentsEndIndex);
    const paymentsTotalPages = Math.ceil(allPayments.length / paymentsPagination.pageSize);
    
    // --- KPIs (Calculated from FILTERED data) ---
    // Note: User might want KPIs to reflect the filter OR total lifetime.
    // Usually, "Active Stock" is current status (snapshot), independent of date range?
    // OR "Stock In during period"?
    // "Active Stock" usually means "currently in warehouse". 
    // If I filter a date range from last year, "Active Stock" might be 0 for those records?
    // Let's assume KPIs should reflect the filtered view for "Financials" but "Active Stock" is tricky.
    // Let's stick to consistent filtering: The KPIs summarize the *displayed* records.
    
    // Calculate total active bags (bagsStored already reflects current stock after withdrawals)
    const totalActiveBags = activeRecords.reduce((sum, r) => sum + r.bagsStored, 0);

    // Filter Payments strictly for the Payments Tab/Financials
    // A record might be included because it started in range, but we only want to sum payments IN range.
    
    let totalBilled = 0;
    let totalPaid = 0;
    
    filteredRecords.forEach(r => {
        // Rent/Bill Logic: deeply dependent on date. 
        // For simplicity: If record is in list, we include its bill? 
        // Or strictly bill generated in range? 
        // Strict financial reporting is complex. 
        // For this "Global Filter" UI:
        // sum(billed) of filtered records.
        // sum(paid) of ONLY payments in range.
        
        totalBilled += (r.hamaliPayable || 0) + (r.totalRentBilled || 0);

        const relevantPayments = r.payments?.filter(p => {
             if (!dateRange?.from) return true;
             const start = startOfDay(dateRange.from);
             const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
             return isWithinInterval(new Date(p.date), { start, end });
        }) || [];

        totalPaid += relevantPayments.reduce((acc: number, p: any) => acc + p.amount, 0);
    });
    
    // Total Due is tricky with partial payments.
    // Let's show calculated values from the filtered view.
    const totalDue = Math.max(0, totalBilled - totalPaid);


    return (
     <div className="flex flex-col gap-6">
        {/* Breadcrumbs */}
        <div className="-ml-1">
            <Breadcrumbs items={[
                { label: 'Dashboard', href: '/' },
                { label: 'Customers', href: '/customers' },
                { label: customer.name }
            ]} />
        </div>

        {/* Header Section */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b pb-4">
            <div className="flex-1">
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
                    {totalDue > 0 && <Badge variant="destructive">Due: {formatCurrency(totalDue)}</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {customer.village}</span>
                    <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {customer.phone}</span>
                    <span className="flex items-center gap-1"><User className="h-4 w-4" /> {customer.fatherName}</span>
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                <div className="flex items-center">
                   <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-full sm:w-auto" />
                </div>
                <div className="flex flex-wrap gap-2">
                    {/* Pass filtered records AND the date range to the statement button */}
                    <CustomerStatementButton customer={customer} records={filteredRecords} dateRange={dateRange} />
                    
                    {/* Payment Link Button - Show if customer has phone and pending dues */}
                    {customer.phone && totalDue > 0 && (
                        <PaymentLinkDialog 
                            customerId={customer.id}
                            customerName={customer.name}
                            defaultAmount={totalDue}
                        />
                    )}
                    
                    <EditCustomerDialog customer={customer} />
                    <DeleteCustomerButton customerId={customer.id} customerName={customer.name} variant="destructive" />
                    <Button asChild size="sm">
                        <Link href={`/inflow?customerId=${customer.id}`}>
                            <PlusCircle className="mr-2 h-4 w-4" /> New Inflow
                        </Link>
                    </Button>
                    <BulkOutflowDialog customer={customer} records={activeRecords} />
                    {activeRecords.length > 0 && totalDue > 0 && (
                        <AddPaymentDialog 
                            record={{
                                ...activeRecords[0]!,
                                balanceDue: totalDue
                            }} 
                        />
                    )}
                </div>
            </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                   <CardTitle className="text-sm font-medium">Active Stock (Filtered)</CardTitle>
                   <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalActiveBags} Bags</div>
                </CardContent>
            </Card>
            <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                   <CardTitle className="text-sm font-medium">Billed (Filtered)</CardTitle>
                   <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalBilled)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                   <CardTitle className="text-sm font-medium">Paid (Filtered)</CardTitle>
                   <CreditCard className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
                </CardContent>
            </Card>
        </div>

        {/* Tabs for Details */}
        <Tabs defaultValue="active" className="w-full">
            <TabsList>
                <TabsTrigger value="active">Active Stock ({activeRecords.length})</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="history">History ({historyRecords.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="mt-4 space-y-4">
                {activeRecords.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        {dateRange ? "No active records in this period." : "No active stock found."}
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 md:grid-cols-2">
                        {paginatedActiveRecords.map((r) => (
                            <div key={r.id} className="border rounded-lg p-4 bg-card shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-semibold">{r.commodityDescription}</h3>
                                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" /> In: {new Date(r.storageStartDate).toLocaleDateString()}
                                        </p>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                             <MapPin className="h-3 w-3" /> Lot: {r.location || 'N/A'}
                                        </p>
                                        <div className="flex gap-2 mt-2">
                                            <Badge variant="secondary" className="text-xs">
                                                REC-{r.recordNumber}
                                            </Badge>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="font-mono text-lg">{r.bagsStored} Bags</Badge>
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                     <Button asChild variant="ghost" size="sm" className="h-8">
                                        <Link href={`/inflow/receipt/${r.id}`}>View Receipt</Link>
                                    </Button>
                                    <Button asChild variant="default" size="sm" className="h-8">
                                        <Link href="/outflow">Withdraw</Link>
                                    </Button>
                                </div>
                            </div>
                        ))}
                        </div>
                        
                        {activeTotalPages > 1 && (
                            <Pagination
                                currentPage={activePage}
                                totalPages={activeTotalPages}
                                totalItems={activeRecords.length}
                                pageSize={activePagination.pageSize}
                                onPageChange={(page) => {
                                    setActivePage(page);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                onPageSizeChange={(size) => {
                                    activePagination.setPageSize(size);
                                    setActivePage(1);
                                }}
                                showPageInfo={true}
                            />
                        )}
                    </>
                )}
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
                {/* Mobile View (Cards) */}
                <div className="grid gap-4 md:hidden">
                    {paginatedPayments.map((payment: any) => (
                        <div key={payment.paymentId} className="border rounded-lg p-4 bg-card shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-sm text-muted-foreground">{new Date(payment.date).toLocaleDateString()}</div>
                                    <div className="font-semibold text-lg">{formatCurrency(payment.amount)}</div>
                                </div>
                                <Badge variant="secondary" className="font-mono">#{payment.recordNumber}</Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="capitalize bg-muted px-2 py-0.5 rounded text-muted-foreground">{payment.type || 'other'}</span>
                                {payment.notes && <span className="text-muted-foreground truncate max-w-[150px]">{payment.notes}</span>}
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <EditPaymentDialog 
                                    payment={{
                                        id: payment.paymentId,
                                        recordId: payment.recordId,
                                        amount: payment.amount,
                                        date: typeof payment.date === 'string' ? payment.date : payment.date.toISOString(),
                                        type: payment.type || 'other',
                                        notes: payment.notes
                                    }}
                                    customerId={customer.id}
                                />
                                <DeletePaymentButton 
                                    paymentId={payment.paymentId}
                                    customerId={customer.id}
                                    amount={payment.amount}
                                />
                            </div>
                        </div>
                    ))}
                     {allPayments.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">No payments recorded.</div>
                     )}
                </div>
                
                {paymentsTotalPages > 1 && (
                    <div className="md:hidden mt-4">
                        <Pagination
                            currentPage={paymentsPage}
                            totalPages={paymentsTotalPages}
                            totalItems={allPayments.length}
                            pageSize={paymentsPagination.pageSize}
                            onPageChange={(page) => {
                                setPaymentsPage(page);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            onPageSizeChange={(size) => {
                                paymentsPagination.setPageSize(size);
                                setPaymentsPage(1);
                            }}
                            showPageInfo={true}
                        />
                    </div>
                )}

                {/* Desktop View (Table) */}
                <div className="hidden md:block rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                            <tr className="text-left">
                                <th className="p-3 font-medium">Date</th>
                                <th className="p-3 font-medium">Record</th>
                                <th className="p-3 font-medium">Type</th>
                                <th className="p-3 text-right font-medium">Amount</th>
                                <th className="p-3 font-medium">Notes</th>
                                <th className="p-3 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedPayments.map((payment: any) => (
                                <tr key={payment.paymentId} className="border-b last:border-0 hover:bg-muted/50">
                                    <td className="p-3">{new Date(payment.date).toLocaleDateString()}</td>
                                    <td className="p-3 font-mono">#{payment.recordNumber}</td>
                                    <td className="p-3 capitalize">{payment.type || 'other'}</td>
                                    <td className="p-3 text-right font-mono font-semibold">{formatCurrency(payment.amount)}</td>
                                    <td className="p-3 text-muted-foreground">{payment.notes || '-'}</td>
                                    <td className="p-3">
                                        <div className="flex justify-end gap-1">
                                            <EditPaymentDialog 
                                                payment={{
                                                    id: payment.paymentId,
                                                    recordId: payment.recordId,
                                                    amount: payment.amount,
                                                    date: typeof payment.date === 'string' ? payment.date : payment.date.toISOString(),
                                                    type: payment.type || 'other',
                                                    notes: payment.notes
                                                }}
                                                customerId={customer.id}
                                            />
                                            <DeletePaymentButton 
                                                paymentId={payment.paymentId}
                                                customerId={customer.id}
                                                amount={payment.amount}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {allPayments.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">No payments in this period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                {paymentsTotalPages > 1 && (
                    <div className="hidden md:block mt-4">
                        <Pagination
                            currentPage={paymentsPage}
                            totalPages={paymentsTotalPages}
                            totalItems={allPayments.length}
                            pageSize={paymentsPagination.pageSize}
                            onPageChange={(page) => {
                                setPaymentsPage(page);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            onPageSizeChange={(size) => {
                                paymentsPagination.setPageSize(size);
                                setPaymentsPage(1);
                            }}
                            showPageInfo={true}
                        />
                    </div>
                )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
                {/* Mobile View (Cards) */}
                <div className="grid gap-4 md:hidden">
                    {paginatedHistoryRecords.map((r) => (
                        <div key={r.id} className="border rounded-lg p-4 bg-card shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-semibold text-foreground">{r.commodityDescription}</h4>
                                    <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                                        <span className="flex items-center gap-1"><ArrowDownToDot className="h-3 w-3" /> {new Date(r.storageStartDate).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1"><ArrowUpFromDot className="h-3 w-3" /> {r.storageEndDate ? new Date(r.storageEndDate).toLocaleDateString() : 'Partial'}</span>
                                    </div>
                                </div>
                                <Badge variant="outline" className="font-mono">#{r.recordNumber}</Badge>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t">
                                <span className="text-sm text-muted-foreground">Bags Out</span>
                                <span className="font-bold">{r.bagsOut}</span>
                            </div>
                        </div>
                    ))}
                    {historyRecords.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">No history in this period.</div>
                    )}
                </div>
                
                {historyTotalPages > 1 && (
                    <div className="md:hidden mt-4">
                        <Pagination
                            currentPage={historyPage}
                            totalPages={historyTotalPages}
                            totalItems={historyRecords.length}
                            pageSize={historyPagination.pageSize}
                            onPageChange={(page) => {
                                setHistoryPage(page);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            onPageSizeChange={(size) => {
                                historyPagination.setPageSize(size);
                                setHistoryPage(1);
                            }}
                            showPageInfo={true}
                        />
                    </div>
                )}

                {/* Desktop View (Table) */}
                 <div className="hidden md:block rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                            <tr className="text-left">
                                <th className="p-3 font-medium">Record ID</th>
                                <th className="p-3 font-medium">Date In</th>
                                <th className="p-3 font-medium">Date Out</th>
                                <th className="p-3 font-medium">Item</th>
                                <th className="p-3 text-right font-medium">Bags Out</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedHistoryRecords.map((r) => (
                                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                                    <td className="p-3 font-mono">#{r.recordNumber}</td>
                                    <td className="p-3">{new Date(r.storageStartDate).toLocaleDateString()}</td>
                                    <td className="p-3">
                                        {r.storageEndDate ? new Date(r.storageEndDate).toLocaleDateString() : <span className="text-amber-600 font-medium text-xs border border-amber-200 bg-amber-50 px-2 py-0.5 rounded-full">Partial</span>}
                                    </td>
                                    <td className="p-3">{r.commodityDescription}</td>
                                    <td className="p-3 text-right font-mono">{r.bagsOut}</td>
                                </tr>
                            ))}
                            {historyRecords.length === 0 && (
                                 <tr>
                                    <td colSpan={5} className="p-8 text-center text-muted-foreground">No history in this period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                 </div>
                 
                 {historyTotalPages > 1 && (
                     <div className="hidden md:block mt-4">
                         <Pagination
                             currentPage={historyPage}
                             totalPages={historyTotalPages}
                             totalItems={historyRecords.length}
                             pageSize={historyPagination.pageSize}
                             onPageChange={(page) => {
                                 setHistoryPage(page);
                                 window.scrollTo({ top: 0, behavior: 'smooth' });
                             }}
                             onPageSizeChange={(size) => {
                                 historyPagination.setPageSize(size);
                                 setHistoryPage(1);
                             }}
                             showPageInfo={true}
                         />
                     </div>
                 )}
            </TabsContent>
        </Tabs>
      </div>
    );
}
