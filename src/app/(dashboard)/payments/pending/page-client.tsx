'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AddPaymentDialog } from '@/components/payments/add-payment-dialog';
import { BulkPaymentDialog } from '@/components/payments/bulk-payment-dialog';
import { Loader2, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { getCustomerRecordsAction } from '@/lib/actions/storage/records';
import { sendPaymentReminderSMS } from '@/lib/sms-actions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { StorageRecord } from '@/lib/definitions';
import { computeChargeDues } from '@/lib/auto-settle';
import { SearchBar } from '@/components/ui/search-bar';

// Build per-record, per-charge dues for the Collect Payment dialog. Active
// records only (matches the backend's getPendingRecords), same waterfall.
function buildDueRecords(rawRecords: any[]) {
    return (rawRecords || [])
        .filter((r: any) => !r.storageEndDate)
        .map((r: any) => {
            const totalPaid = (r.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
            const dues = computeChargeDues({
                hamaliPayable: r.hamaliPayable || 0,
                insurancePayable: r.insurancePayable || 0,
                rentBilled: r.totalRentBilled || 0,
                totalPaid,
            });
            return {
                id: r.id,
                recordNumber: r.recordNumber || `REC-${r.id.substring(0, 8)}`,
                hamaliDue: dues.hamaliDue,
                insuranceDue: dues.insuranceDue,
                rentDue: dues.rentDue,
                totalDue: dues.hamaliDue + dues.insuranceDue + dues.rentDue,
            };
        })
        .filter((r: any) => r.totalDue > 0);
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from '@/hooks/use-pagination';
import { Pagination } from '@/components/ui/pagination';

interface PendingPaymentsClientProps {
    pendingCustomers: any[];
}

export function PendingPaymentsClient({ pendingCustomers }: PendingPaymentsClientProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
    const [loadingCustomerId, setLoadingCustomerId] = useState<string | null>(null);
    const [customerRecords, setCustomerRecords] = useState<Record<string, StorageRecord[]>>({});
    const [selectedRecord, setSelectedRecord] = useState<(StorageRecord & { balanceDue: number }) | null>(null);
    const [selectedBulkCustomer, setSelectedBulkCustomer] = useState<any | null>(null);
    const [sendingSMS, setSendingSMS] = useState<string | null>(null);
    const { toast } = useToast();
    
    // Search and filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'balance-desc' | 'balance-asc' | 'name-asc' | 'name-desc'>('balance-desc');

    // Filtered and sorted customers
    const filteredCustomers = useMemo(() => {
        let result = [...pendingCustomers];
        
        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            result = result.filter(c => 
                c.name.toLowerCase().includes(search) ||
                c.phone.includes(searchTerm)
            );
        }
        
        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'balance-desc':
                    return b.balance - a.balance;
                case 'balance-asc':
                    return a.balance - b.balance;
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                default:
                    return 0;
            }
        });
        
        return result;
    }, [pendingCustomers, searchTerm, sortBy]);

    // Pagination
    const pagination = usePagination(20);
    const [currentPage, setCurrentPage] = useState(1);
    const startIndex = (currentPage - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredCustomers.length / pagination.pageSize);

    const handleToggleExpand = async (customerId: string) => {
        if (expandedCustomerId === customerId) {
            // Collapse
            setExpandedCustomerId(null);
        } else {
            // Expand
            setExpandedCustomerId(customerId);
            
            // Fetch records if not already loaded
            if (!customerRecords[customerId]) {
                setLoadingCustomerId(customerId);
                try {
                    const records = await getCustomerRecordsAction(customerId);
                    const activeRecords = records.filter((r: any) => !r.storageEndDate);
                    setCustomerRecords(prev => ({ ...prev, [customerId]: activeRecords }));
                } catch (error) {
                    console.error('Error fetching records:', error);
                    alert('Failed to load customer records');
                    setExpandedCustomerId(null);
                } finally {
                    setLoadingCustomerId(null);
                }
            }
        }
    };

    const handlePayRecord = (record: StorageRecord, _customerBalance: number) => {
        // Calculate balance for this specific record
        const payments = record.payments || [];
        const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const totalBilled = (record.totalRentBilled || 0) + (record.hamaliPayable || 0);
        const balanceDue = totalBilled - totalPaid;

        setSelectedRecord({
            ...record,
            balanceDue
        });
    };

    const handleSendReminder = async (customerId: string, customerPhone: string) => {
        setSendingSMS(customerId);
        try {
            const result = await sendPaymentReminderSMS(customerId, customerPhone);
            if (result.success) {
                toast({ title: "SMS Sent", description: "Payment reminder sent successfully" });
            } else {
                toast({ title: "Error", description: result.error || "Failed to send SMS", variant: "destructive" });
            }
        } finally {
            setSendingSMS(null);
        }
    };
    
    const handleBulkPayment = async (customer: any) => {
        const records = customerRecords[customer.id] || [];
        
        if (records.length === 0) {
            // Load records first
            setLoadingCustomerId(customer.id);
            const fetchedRecords = await getCustomerRecordsAction(customer.id);
            setCustomerRecords(prev => ({ ...prev, [customer.id]: fetchedRecords }));
            setLoadingCustomerId(null);
            
            // Prepare bulk data
            const bulkData = {
                id: customer.id,
                name: customer.name,
                totalDues: customer.balance,
                records: buildDueRecords(fetchedRecords)
            };
            setSelectedBulkCustomer(bulkData);
        } else {
            // Use existing records
            const bulkData = {
                id: customer.id,
                name: customer.name,
                totalDues: customer.balance,
                records: buildDueRecords(records)
            };
            setSelectedBulkCustomer(bulkData);
        }
    };

    return (
        <>
            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <SearchBar 
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search by customer name or phone..."
                    className="flex-1"
                />
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="balance-desc">Balance: High to Low</SelectItem>
                        <SelectItem value="balance-asc">Balance: Low to High</SelectItem>
                        <SelectItem value="name-asc">Name: A to Z</SelectItem>
                        <SelectItem value="name-desc">Name: Z to A</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-4 scroll-mt-20" ref={containerRef}>
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden">
                    {paginatedCustomers.map((customer: any) => {
                        const isExpanded = expandedCustomerId === customer.id;
                        const isLoading = loadingCustomerId === customer.id;
                        const records = customerRecords[customer.id] || [];

                        return (
                            <Card key={customer.id} className="overflow-hidden">
                                <CardHeader className="bg-muted/40 p-4 pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1 flex-1">
                                            <CardTitle className="text-base font-medium">{customer.name}</CardTitle>
                                            <div className="text-xs text-muted-foreground font-mono">{customer.phone}</div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleToggleExpand(customer.id)}
                                        >
                                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 pt-2 space-y-3">
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="text-muted-foreground">Total Billed:</div>
                                        <div className="text-right font-medium">{formatCurrency(customer.totalBilled)}</div>
                                        
                                        <div className="text-muted-foreground">Amount Paid:</div>
                                        <div className="text-right text-green-600">{formatCurrency(customer.totalPaid)}</div>
                                        
                                        <div className="text-muted-foreground font-medium pt-1 border-t">Balance Due:</div>
                                        <div className="text-right font-bold text-destructive pt-1 border-t">{formatCurrency(customer.balance)}</div>
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div className="flex gap-2 mt-3">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleBulkPayment(customer)}
                                        >
                                            Bulk Payment
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSendReminder(customer.id, customer.phone)}
                                            disabled={sendingSMS === customer.id}
                                        >
                                            {sendingSMS === customer.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <MessageSquare className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>

                                    {/* Expanded Records */}
                                    {isExpanded && (
                                        <div className="mt-4 space-y-2">
                                            {isLoading ? (
                                                <div className="flex items-center justify-center py-4">
                                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                                </div>
                                            ) : records.length === 0 ? (
                                                <div className="text-center py-4 text-sm text-muted-foreground">
                                                    No active records
                                                </div>
                                            ) : (
                                                records.map((record: any) => {
                                                    const payments = record.payments || [];
                                                    const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
                                                    const totalBilled = (record.totalRentBilled || 0) + (record.hamaliPayable || 0);
                                                    const balance = totalBilled - totalPaid;

                                                    return (
                                                        <div key={record.id} className="border rounded-lg p-3 bg-muted/20">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <div className="font-mono text-sm font-medium">
                                                                        {record.recordNumber || `REC-${record.id.substring(0, 8)}`}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {format(new Date(record.storageStartDate), 'dd MMM yyyy')}
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handlePayRecord(record, customer.balance)}
                                                                    disabled={balance <= 0}
                                                                >
                                                                    Pay
                                                                </Button>
                                                            </div>
                                                            <div className="text-sm">{record.commodityDescription} • {record.bagsStored} bags</div>
                                                            <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                                                                <div>
                                                                    <div className="text-muted-foreground">Billed</div>
                                                                    <div className="font-medium">{formatCurrency(totalBilled)}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-muted-foreground">Paid</div>
                                                                    <div className="font-medium text-green-600">{formatCurrency(totalPaid)}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-muted-foreground">Balance</div>
                                                                    <div className="font-medium text-destructive">{formatCurrency(balance)}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleSendReminder(customer.id, customer.name)}
                                                disabled={sendingSMS === customer.id}
                                            >
                                                {sendingSMS === customer.id ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Sending...
                                                    </>
                                                ) : (
                                                    <>
                                                        <MessageSquare className="h-4 w-4 mr-2" />
                                                        Send Reminder
                                                    </>
                                                )}
                                            </Button>
                                            <Link href={`/customers/${customer.id}`} className="flex-1">
                                                <Button variant="outline" className="w-full" size="sm">View Full Details</Button>
                                            </Link>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {filteredCustomers.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground bg-card rounded-lg border">
                            {searchTerm ? 'No customers found matching your search.' : 'No pending payments.'}
                        </div>
                    )}
                </div>

                {/* Desktop View */}
                <Card className="hidden md:block">
                    <CardHeader>
                        <CardTitle>Outstanding Balances</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead className="text-right">Total Billed</TableHead>
                                    <TableHead className="text-right">Paid</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead className="w-[150px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedCustomers.map((customer: any) => {
                                    const isExpanded = expandedCustomerId === customer.id;
                                    const isLoading = loadingCustomerId === customer.id;
                                    const records = customerRecords[customer.id] || [];

                                    return (
                                        <React.Fragment key={customer.id}>
                                            <TableRow className="cursor-pointer hover:bg-muted/50">
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleToggleExpand(customer.id)}
                                                    >
                                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="font-medium">{customer.name}</TableCell>
                                                <TableCell>{customer.phone}</TableCell>
                                                <TableCell className="text-right font-mono font-medium">{formatCurrency(customer.totalBilled)}</TableCell>
                                                <TableCell className="text-right font-mono text-green-600">{formatCurrency(customer.totalPaid)}</TableCell>
                                                <TableCell className="text-right font-mono text-destructive font-bold">{formatCurrency(customer.balance)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleBulkPayment(customer)}
                                                        >
                                                            Bulk Payment
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleSendReminder(customer.id, customer.name)}
                                                            disabled={sendingSMS === customer.id}
                                                        >
                                                            {sendingSMS === customer.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <MessageSquare className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        <Link href={`/customers/${customer.id}`}>
                                                            <Button size="sm" variant="outline">View Details</Button>
                                                        </Link>
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {/* Expanded Records Row */}
                                            {isExpanded && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="bg-muted/20 p-0">
                                                        {isLoading ? (
                                                            <div className="flex items-center justify-center py-8">
                                                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                                            </div>
                                                        ) : records.length === 0 ? (
                                                            <div className="text-center py-8 text-muted-foreground">
                                                                No active records for this customer
                                                            </div>
                                                        ) : (
                                                            <div className="p-4">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead>Record #</TableHead>
                                                                            <TableHead>Date In</TableHead>
                                                                            <TableHead>Commodity</TableHead>
                                                                            <TableHead className="text-right">Bags</TableHead>
                                                                            <TableHead className="text-right">Billed</TableHead>
                                                                            <TableHead className="text-right">Paid</TableHead>
                                                                            <TableHead className="text-right">Balance</TableHead>
                                                                            <TableHead className="text-right">Action</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {records.map((record: any) => {
                                                                            const payments = record.payments || [];
                                                                            const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
                                                                            const totalBilled = (record.totalRentBilled || 0) + (record.hamaliPayable || 0);
                                                                            const balance = totalBilled - totalPaid;

                                                                            return (
                                                                                <TableRow key={record.id}>
                                                                                    <TableCell className="font-medium font-mono">
                                                                                        {record.recordNumber || `REC-${record.id.substring(0, 8)}`}
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        {format(new Date(record.storageStartDate), 'dd MMM yyyy')}
                                                                                    </TableCell>
                                                                                    <TableCell>{record.commodityDescription || '-'}</TableCell>
                                                                                    <TableCell className="text-right">{record.bagsStored}</TableCell>
                                                                                    <TableCell className="text-right">{formatCurrency(totalBilled)}</TableCell>
                                                                                    <TableCell className="text-right text-green-600">{formatCurrency(totalPaid)}</TableCell>
                                                                                    <TableCell className="text-right font-medium">
                                                                                        {formatCurrency(balance)}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right">
                                                                                        <Button
                                                                                            size="sm"
                                                                                            onClick={() => handlePayRecord(record, customer.balance)}
                                                                                            disabled={balance <= 0}
                                                                                        >
                                                                                            Pay
                                                                                        </Button>
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            );
                                                                        })}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {filteredCustomers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                            {searchTerm ? 'No customers found matching your search.' : 'No pending payments.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {totalPages > 1 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredCustomers.length}
                    pageSize={pagination.pageSize}
                    onPageChange={(page) => {
                        setCurrentPage(page);
                        containerRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    onPageSizeChange={(size) => {
                        pagination.setPageSize(size);
                        setCurrentPage(1);
                    }}
                    showPageInfo={true}
                />
            )}

            {/* Payment Dialog */}
            {selectedRecord && (
                <AddPaymentDialog 
                    record={selectedRecord}
                    autoOpen={true}
                    onClose={() => setSelectedRecord(null)}
                />
            )}
            
            {/* Bulk Payment Dialog */}
            {selectedBulkCustomer && (
                <BulkPaymentDialog
                    customer={selectedBulkCustomer}
                    autoOpen={true}
                    onClose={() => setSelectedBulkCustomer(null)}
                />
            )}
        </>
    );
}
