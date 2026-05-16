'use client';

import { useState, useMemo, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowUpToLine, Trash2, MoreHorizontal, ReceiptText } from "lucide-react";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DeleteOutflowDialog } from "@/components/outflow/delete-outflow-dialog";
import { MobileCard } from "@/components/ui/mobile-card";
import { PrintButton } from "@/components/common/print-button";
import { SearchBar } from "@/components/ui/search-bar";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { FilterPopover, FilterSection, MultiSelect, NumberRangeInput, SortDropdown, ShareFilterButton, ExportButton, type MultiSelectOption, type SortOption } from '@/components/filters';
import { exportOutflowRecordsWithFilters } from "@/lib/export-utils-filtered"; 
import { getAppliedFiltersSummary } from "@/lib/url-filters";
import { useUrlFilters } from '@/hooks/use-url-filters';
import { usePagination } from '@/hooks/use-pagination';
import { Pagination } from '@/components/ui/pagination';
import { useWarehouses } from '@/contexts/warehouse-context';
import { formatCurrency } from '@/lib/utils';
import type { OutflowRecord } from '@/lib/definitions';

// Filter state interface
interface OutflowFilterState {
  q: string;
  dateRange: DateRange | undefined;
  selectedCommodities: string[];
  minBags: number | null;
  maxBags: number | null;
  sortBy: string;
}

interface OutflowListClientProps {
    outflows: OutflowRecord[]; 
}

export function OutflowListClient({ outflows }: OutflowListClientProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    // URL-synchronized filter state
    const [filters, setFilters] = useUrlFilters<OutflowFilterState>({
        q: '',
        dateRange: undefined,
        selectedCommodities: [],
        minBags: null,
        maxBags: null,
        sortBy: 'date-desc'
    });
    
    const { currentWarehouse: warehouse } = useWarehouses();
    
    // Extract values
    const query = filters.q;
    const dateRange = filters.dateRange;
    const selectedCommodities = filters.selectedCommodities;
    const minBags = filters.minBags;
    const maxBags = filters.maxBags;
    const sortBy = filters.sortBy;

    const filteredOutflows = useMemo(() => {
        let result = [...outflows];

        // Search filter
        if (query) {
            const search = query.toLowerCase();
            result = result.filter(i =>
                i.customerName?.toLowerCase().includes(search) ||
                i.commodity?.toLowerCase().includes(search) ||
                i.recordNumber?.toLowerCase().includes(search) ||
                i.id?.toLowerCase().includes(search)
            );
        }

        // Date filter
        if (dateRange?.from) {
            result = result.filter(i => {
                const date = new Date(i.date);
                return isWithinInterval(date, {
                    start: startOfDay(dateRange.from!),
                    end: dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!)
                });
            });
        }

        // Commodity filter
        if (selectedCommodities.length > 0) {
            result = result.filter(i => selectedCommodities.includes(i.commodity));
        }

        // Bags range filter
        if (minBags !== null) result = result.filter(i => i.bags >= minBags);
        if (maxBags !== null) result = result.filter(i => i.bags <= maxBags);

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'date-desc':
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                case 'date-asc':
                    return new Date(a.date).getTime() - new Date(b.date).getTime();
                case 'bags-desc':
                    return b.bags - a.bags;
                case 'bags-asc':
                    return a.bags - b.bags;
                case 'customer-asc':
                    return (a.customerName || '').localeCompare(b.customerName || '');
                case 'customer-desc':
                    return (b.customerName || '').localeCompare(a.customerName || '');
                case 'rent-desc':
                     return (b.totalRent || 0) - (a.totalRent || 0);
                default:
                    return 0;
            }
        });

        return result;
    }, [outflows, query, dateRange, selectedCommodities, minBags, maxBags, sortBy]);

    // Pagination
    const pagination = usePagination(20);
    const [currentPage, setCurrentPage] = useState(1);
    const startIndex = (currentPage - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    const paginatedOutflows = filteredOutflows.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredOutflows.length / pagination.pageSize);

    // Prepare filter options
    const commodityOptions: MultiSelectOption[] = useMemo(() => {
        const unique = Array.from(new Set(outflows.map(i => i.commodity)));
        return unique.map(name => ({ label: name, value: name }));
    }, [outflows]);

    const sortOptions: SortOption[] = [
        { label: 'Newest First', value: 'date-desc', icon: 'desc' },
        { label: 'Oldest First', value: 'date-asc', icon: 'asc' },
        { label: 'Most Bags', value: 'bags-desc', icon: 'desc' },
        { label: 'Least Bags', value: 'bags-asc', icon: 'asc' },
        { label: 'Highest Rent', value: 'rent-desc', icon: 'desc' },
        { label: 'Customer (A-Z)', value: 'customer-asc', icon: 'asc' },
        { label: 'Customer (Z-A)', value: 'customer-desc', icon: 'desc' },
    ];

    const activeFilters = useMemo(() => {
        let count = 0;
        if (dateRange?.from) count++;
        if (selectedCommodities.length > 0) count++;
        if (minBags !== null || maxBags !== null) count++;
        return count;
    }, [dateRange, selectedCommodities, minBags, maxBags]);

    const handleClearFilters = () => {
        setFilters(prev => ({
            ...prev,
            dateRange: undefined,
            selectedCommodities: [],
            minBags: null,
            maxBags: null
        }));
    };

    const handleExport = (format: 'excel' | 'pdf' = 'excel') => {
        const metadata = {
            totalRecords: outflows.length,
            filteredRecords: filteredOutflows.length,
            appliedFilters: getAppliedFiltersSummary(filters),
            exportDate: new Date()
        };
        exportOutflowRecordsWithFilters(filteredOutflows as any[], metadata, format);
    };
    const handleExportExcel = () => handleExport('excel');
    const handleExportPdf = () => handleExport('pdf');

    return (
        <div className="mt-8 scroll-mt-20" ref={containerRef}>
            <h3 className="text-lg font-medium mb-4">Recent Outflows</h3>

            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <SearchBar
                    value={query}
                    onChange={(value) => setFilters(prev => ({ ...prev, q: value }))}
                    placeholder="Search by customer or commodity..."
                    className="flex-1"
                />
                <DatePickerWithRange date={dateRange} setDate={(range) => setFilters(prev => ({ ...prev, dateRange: range }))} className="w-full sm:w-auto" />
                <FilterPopover
                    activeFilters={activeFilters}
                    onClear={handleClearFilters}
                >
                    <FilterSection title="Commodities">
                        <MultiSelect
                            options={commodityOptions}
                            selected={selectedCommodities}
                            onChange={(value) => setFilters(prev => ({ ...prev, selectedCommodities: value }))}
                            placeholder="All commodities"
                        />
                    </FilterSection>
                    <FilterSection title="Bags Range">
                        <NumberRangeInput
                            min={minBags}
                            max={maxBags}
                            onMinChange={(value) => setFilters(prev => ({ ...prev, minBags: value }))}
                            onMaxChange={(value) => setFilters(prev => ({ ...prev, maxBags: value }))}
                            minPlaceholder="Min bags"
                            maxPlaceholder="Max bags"
                        />
                    </FilterSection>
                </FilterPopover>
                <SortDropdown
                    options={sortOptions}
                    value={sortBy}
                    onChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}
                />
                <ShareFilterButton filters={filters} />
                <div className="hidden sm:block">
                    <ExportButton
                        onExportExcel={handleExportExcel}
                        onExportPdf={handleExportPdf}
                        label="Export"
                    />
                </div>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {paginatedOutflows.map((record) => (
                    <MobileCard key={record.id}>
                        <MobileCard.Header>
                            <div className="flex-1">
                                <MobileCard.Title>{record.customerName}</MobileCard.Title>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {record.date.toLocaleDateString()} • {record.recordNumber || record.id.slice(0, 8)}
                                </p>
                            </div>
                            <MobileCard.Badge variant="destructive">-{record.bags} Bags</MobileCard.Badge>
                        </MobileCard.Header>
                        <MobileCard.Content>
                            <div className="flex justify-between items-center">
                                <p className="text-sm">{record.commodity}</p>
                                <p className="text-sm font-medium">{formatCurrency(record.totalRent || 0)}</p>
                            </div>
                        </MobileCard.Content>
                        <MobileCard.Actions>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {(record as any).consolidatedInvoiceNo && (
                                        <DropdownMenuItem asChild>
                                            <Link
                                                href={`/outflow/batch/${encodeURIComponent((record as any).consolidatedInvoiceNo)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full justify-start cursor-pointer flex items-center"
                                            >
                                                <ReceiptText className="mr-2 h-4 w-4" />
                                                View Consolidated Bill
                                            </Link>
                                        </DropdownMenuItem>
                                    )}
                                    <DeleteOutflowDialog transactionId={record.id} bags={record.bags}>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Reverse Outflow
                                        </DropdownMenuItem>
                                    </DeleteOutflowDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </MobileCard.Actions>
                    </MobileCard>
                ))}
                {filteredOutflows.length === 0 && (
                    <EmptyState
                        icon={ArrowUpToLine}
                        title={query || dateRange ? "No outflows found" : "No outflows yet"}
                        description={query || dateRange ? "Try adjusting your search or date range." : "Your recent outflows will appear here."}
                    />
                )}
            </div>

            {/* Desktop View */}
            <div className="rounded-md border bg-card hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Ref</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Bags Out</TableHead>
                            <TableHead className="text-right">Rent Paid</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedOutflows.map((record) => {
                            return (
                                <TableRow key={record.id}>
                                    <TableCell>{record.date.toLocaleDateString()}</TableCell>
                                    <TableCell className="font-medium font-mono">{record.recordNumber || record.id.slice(0, 8)}</TableCell>
                                    <TableCell>{record.customerName}</TableCell>
                                    <TableCell>{record.commodity}</TableCell>
                                    <TableCell className="text-right text-destructive font-medium">-{record.bags}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(record.totalRent || 0)}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {(record as any).consolidatedInvoiceNo && (
                                                    <DropdownMenuItem asChild>
                                                        <Link
                                                            href={`/outflow/batch/${encodeURIComponent((record as any).consolidatedInvoiceNo)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-full justify-start cursor-pointer flex items-center"
                                                        >
                                                            <ReceiptText className="mr-2 h-4 w-4" />
                                                            View Consolidated Bill
                                                        </Link>
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem asChild>
                                                    <PrintButton
                                                        data={{
                                                            ...record,
                                                            warehouseName: warehouse?.name,
                                                            warehouseAddress: warehouse?.location,
                                                            gstNo: warehouse?.gst_number,
                                                        }}
                                                        type="outflow"
                                                        buttonText="Print Receipt"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full justify-start cursor-pointer"
                                                    />
                                                </DropdownMenuItem>
                                                <DeleteOutflowDialog transactionId={record.id} bags={record.bags}>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Reverse Outflow
                                                    </DropdownMenuItem>
                                                </DeleteOutflowDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {filteredOutflows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48">
                                    <EmptyState
                                        icon={ArrowUpToLine}
                                        title={query || dateRange ? "No outflows found" : "No outflows yet"}
                                        description={query || dateRange ? "Try adjusting your search or date range." : "Your recent outflows will appear here."}
                                    />
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            
            {totalPages > 1 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredOutflows.length}
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
        </div>
    );
}
