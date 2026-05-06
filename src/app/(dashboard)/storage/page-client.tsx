'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Warehouse, IndianRupee, Search, X } from "lucide-react";
import { calculateFinalRent } from "@/lib/billing";
import { formatCurrency } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import type { StorageRecord, Customer } from "@/lib/definitions";
import { useRef, useState, useMemo } from 'react';
import { FinalizeDryingDialog } from "@/components/storage/finalize-drying-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { MobileCard } from "@/components/ui/mobile-card";
import { usePagination } from '@/hooks/use-pagination';
import { Checkbox } from "@/components/ui/checkbox";
import { Printer } from "lucide-react";
import { ExportButton } from "@/components/shared/export-button";
import { exportStorageRecordsToExcel, generateTallyXML, downloadFile } from "@/lib/export-utils";
import { exportStorageRecordsWithFilters } from "@/lib/export-utils-filtered";
import { getAppliedFiltersSummary } from "@/lib/url-filters";
import { ActionsMenu } from '@/components/dashboard/actions-menu';
import useSWR from 'swr';
import { fetchStorageRecordsAction } from '@/lib/actions/storage/records';
import { Loader2 } from 'lucide-react';
import { FilterPopover, FilterSection, MultiSelect, NumberRangeInput, SortDropdown, ShareFilterButton, type MultiSelectOption, type SortOption } from '@/components/filters';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUrlFilters } from '@/hooks/use-url-filters';
import { useDebounce } from "@uidotdev/usehooks";
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

// Filter state interface
interface StorageFilterState {
  q: string;
  status: 'active' | 'all' | 'released';
  selectedCommodities: string[];
  selectedLocations: string[];
  dateRange: DateRange | undefined;
  minBags: number | null;
  maxBags: number | null;
  minRent: number | null;
  maxRent: number | null;
  sortBy: string;
  page: number;
}


export function StoragePageClient({ 
  records: initialRecords, 
  totalPages: initialTotalPages, 
  currentPage: initialPage, 
  initialStats, 
  customers,
    userRole,
  crops,
  lots
}: { 
  records: StorageRecord[], 
  totalPages: number, 
  currentPage: number,
  initialStats: { totalInflow: number, totalOutflow: number, balanceStock: number }, 
  customers: Customer[] 
  userRole?: string
  crops: any[]
  lots: any[]
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  
  // URL-synchronized filter state
  const [filters, setFilters] = useUrlFilters<StorageFilterState>({
    q: '',
    status: 'active',
    selectedCommodities: [],
    selectedLocations: [],
    dateRange: undefined,
    minBags: null,
    maxBags: null,
    minRent: null,
    maxRent: null,
    sortBy: 'date-desc',
    page: initialPage
  });
  
  // Extract individual values for easier access
  const query = filters.q;
  const statusFilter = filters.status;
  const selectedCommodities = filters.selectedCommodities;
  const selectedLocations = filters.selectedLocations;
  const dateRange = filters.dateRange;
  const minBags = filters.minBags;
  const maxBags = filters.maxBags;
  const minRent = filters.minRent;
  const maxRent = filters.maxRent;
  const sortBy = filters.sortBy;
  const page = filters.page;

  
  const debouncedSearch = useDebounce(query, 300);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());

  // "In Drying" filter — driven by ?filter=drying URL param so the dashboard
  // "In Drying" stat card can deep-link straight to the filtered list.
  const dryingOnly = searchParams.get('filter') === 'drying';
  const setDryingOnly = (next: boolean) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set('filter', 'drying');
    else sp.delete('filter');
    router.replace(`?${sp.toString()}`);
  };

  // SWR for data fetching with different status
  // Pagination state
  const pagination = usePagination(20);
  const pageSize = pagination.pageSize;
  
  const { data, isLoading } = useSWR(
    ['storage-records', page, debouncedSearch, statusFilter, pageSize], 
    async ([_, p, q, s, size]) => fetchStorageRecordsAction(p as number, size as number, q as string, s as any),
    {
        fallbackData: page === initialPage && (debouncedSearch || '') === (searchParams.get('q') || '') && statusFilter === 'active' ? {
            records: initialRecords,
            totalPages: initialTotalPages,
            totalCount: 0
        } : undefined,
        revalidateOnFocus: true,
    }
  );

  let records = data?.records || [];
  const totalPages = data?.totalPages || 1;
  const isTableLoading = isLoading && !data;

  // Client-side filtering for advanced filters (commodity, location, bags, rent, date)
  const filteredRecords = useMemo(() => {
    let result = [...records];

    // Commodity filter
    if (selectedCommodities.length > 0) {
      result = result.filter(r => selectedCommodities.includes(r.commodityDescription));
    }

    // Location filter
    if (selectedLocations.length > 0) {
      result = result.filter(r => selectedLocations.includes(r.location));
    }

    // Date range filter
    if (dateRange?.from) {
      result = result.filter(r => {
        const date = new Date(r.storageStartDate);
        return isWithinInterval(date, {
          start: startOfDay(dateRange.from!),
          end: dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!)
        });
      });
    }

    // Bags range filter
    if (minBags !== null) {
      result = result.filter(r => r.bagsStored >= minBags);
    }
    if (maxBags !== null) {
      result = result.filter(r => r.bagsStored <= maxBags);
    }

    // Rent range filter (calculate rent first)
    if (minRent !== null || maxRent !== null) {
      result = result.filter(r => {
        const { rent } = calculateFinalRent(r, new Date(), r.bagsStored);
        if (minRent !== null && rent < minRent) return false;
        if (maxRent !== null && rent > maxRent) return false;
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.storageStartDate).getTime() - new Date(a.storageStartDate).getTime();
        case 'date-asc':
          return new Date(a.storageStartDate).getTime() - new Date(b.storageStartDate).getTime();
        case 'bags-desc':
          return b.bagsStored - a.bagsStored;
        case 'bags-asc':
          return a.bagsStored - b.bagsStored;
        case 'rent-desc': {
          const rentA = calculateFinalRent(a, new Date(), a.bagsStored).rent;
          const rentB = calculateFinalRent(b, new Date(), b.bagsStored).rent;
          return rentB - rentA;
        }
        case 'rent-asc': {
          const rentA = calculateFinalRent(a, new Date(), a.bagsStored).rent;
         const rentB = calculateFinalRent(b, new Date(), b.bagsStored).rent;
          return rentA - rentB;
        }
        case 'customer-asc':
          return (a.customerName || '').localeCompare(b.customerName || '');
        case 'customer-desc':
          return (b.customerName || '').localeCompare(a.customerName || '');
        default:
          return 0;
      }
    });

    // "In Drying" filter — only Plot inflows whose loadBags hasn't been set.
    if (dryingOnly) {
      result = result.filter(
        (r) => r.inflowType === 'transfer_in' && (!r.loadBags || r.loadBags === 0)
      );
    }

    return result;
  }, [records, selectedCommodities, selectedLocations, dateRange, minBags, maxBags, minRent, maxRent, sortBy, dryingOnly]);

  // Create filter options
  const commodityOptions: MultiSelectOption[] = useMemo(() => {
    const unique = Array.from(new Set(crops.map(c => c.name)));
    return unique.map(name => ({ label: name, value: name }));
  }, [crops]);

  const locationOptions: MultiSelectOption[] = useMemo(() => {
    const unique = Array.from(new Set(lots.map(l => l.name)));
    return unique.map(name => ({ label: name, value: name }));
  }, [lots]);

  const sortOptions: SortOption[] = [
    { label: 'Newest First', value: 'date-desc', icon: 'desc' },
    { label: 'Oldest First', value: 'date-asc', icon: 'asc' },
    { label: 'Most Bags', value: 'bags-desc', icon: 'desc' },
    { label: 'Least Bags', value: 'bags-asc', icon: 'asc' },
    { label: 'Highest Rent', value: 'rent-desc', icon: 'desc' },
    { label: 'Lowest Rent', value: 'rent-asc', icon: 'asc' },
    { label: 'Customer (A-Z)', value: 'customer-asc', icon: 'asc' },
    { label: 'Customer (Z-A)', value: 'customer-desc', icon: 'desc' },
  ];

  // Count active filters
  const activeFilters = useMemo(() => {
    let count = 0;
    if (selectedCommodities.length > 0) count++;
    if (selectedLocations.length > 0) count++;
    if (dateRange?.from) count++;
    if (minBags !== null || maxBags !== null) count++;
    if (minRent !== null || maxRent !== null) count++;
    return count;
  }, [status, selectedCommodities, selectedLocations, dateRange, minBags, maxBags, minRent, maxRent]);

  const handleClearFilters = () => {
    setFilters(prev => ({
      ...prev,
      status: 'active',
      selectedCommodities: [],
      selectedLocations: [],
      dateRange: undefined,
      minBags: null,
      maxBags: null,
      minRent: null,
      maxRent: null
    }));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedRecords(new Set(filteredRecords.map(r => r.id)));
    } else {
        setSelectedRecords(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
      const newSelected = new Set(selectedRecords);
      if (checked) {
          newSelected.add(id);
      } else {
          newSelected.delete(id);
      }
      setSelectedRecords(newSelected);
  };

  const handlePrintLabels = () => {
      const ids = Array.from(selectedRecords).join(',');
      router.push(`/storage/print-labels?ids=${ids}`);
  };

  const handleExport = (format: 'excel' | 'pdf' = 'excel') => {
    const recordsToExport = filteredRecords.filter(r => selectedRecords.has(r.id));

    // If no records selected, export ALL filtered records
    const finalRecords = recordsToExport.length > 0 ? recordsToExport : filteredRecords;

    const metadata = {
        totalRecords: initialRecords.length,
        filteredRecords: finalRecords.length,
        appliedFilters: getAppliedFiltersSummary(filters),
        exportDate: new Date()
    };

    exportStorageRecordsWithFilters(finalRecords, metadata, format);
  };
  const handleExportExcel = () => handleExport('excel');
  const handleExportPdf = () => handleExport('pdf');

  const handleExportTally = () => {
      const recordsToExport = selectedRecords.size > 0 
        ? filteredRecords.filter(r => selectedRecords.has(r.id))
        : filteredRecords;
      const xml = generateTallyXML(recordsToExport);
      downloadFile(xml, 'tally-import.xml', 'text/xml');
  };



  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
    containerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const stats = useMemo(() => {
    return {
        ...initialStats,
        estimatedRent: filteredRecords.reduce((total, record) => {
             const { rent } = calculateFinalRent(record, new Date(), record.bagsStored);
             return total + rent;
        }, 0)
    }
  }, [filteredRecords, initialStats]);

  return (
    <>
      <PageHeader
        title="Storage Overview"
        description="A high-level summary of your warehouse inventory."
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Storage' }
        ]}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Inflow</CardTitle>
                <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.totalInflow} bags</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Outflow</CardTitle>
                <ArrowUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.totalOutflow} bags</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Balance Stock</CardTitle>
                <Warehouse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.balanceStock} bags</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estimated Rent Due</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.estimatedRent)}</div>
                <p className="text-xs text-muted-foreground">
                    Based on {filteredRecords.length} records
                </p>
            </CardContent>
        </Card>
      </div>

      {/* Detailed Stock Register */}
      <div className="scroll-mt-20" ref={containerRef}>
        <div className="flex flex-col gap-4 mb-4">
          {/* Top row - Title and Search */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              Detailed Stock Register
              {isTableLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer..."
                value={query}
                onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value, page: 1 }))}
                className="pl-10"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                  onClick={() => setFilters(prev => ({ ...prev, q: '', page: 1 }))}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Bottom row - Filters and Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Status Tabs */}
            <Select value={status} onValueChange={(v: any) => setFilters(prev => ({ ...prev, status: v }))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="released">Released</SelectItem>
                <SelectItem value="all">All Records</SelectItem>
              </SelectContent>
            </Select>

            {/* Advanced Filters */}
            <FilterPopover
              activeFilters={activeFilters}
              onClear={handleClearFilters}
            >
              <FilterSection title="Date Range">
                <DatePickerWithRange 
                  date={dateRange} 
                  setDate={(range) => setFilters(prev => ({ ...prev, dateRange: range }))} 
                />
              </FilterSection>

              <FilterSection title="Commodities">
                <MultiSelect
                  options={commodityOptions}
                  selected={selectedCommodities}
                  onChange={(value) => setFilters(prev => ({ ...prev, selectedCommodities: value }))}
                  placeholder="All commodities"
                />
              </FilterSection>

              <FilterSection title="Locations">
                <MultiSelect
                  options={locationOptions}
                  selected={selectedLocations}
                  onChange={(value) => setFilters(prev => ({ ...prev, selectedLocations: value }))}
                  placeholder="All locations"
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

              <FilterSection title="Rent Range">
                <NumberRangeInput
                  min={minRent}
                  max={maxRent}
                  onMinChange={(value) => setFilters(prev => ({ ...prev, minRent: value }))}
                  onMaxChange={(value) => setFilters(prev => ({ ...prev, maxRent: value }))}
                  minPlaceholder="Min rent"
                  maxPlaceholder="Max rent"
                />
              </FilterSection>
            </FilterPopover>

            {/* Sort Dropdown */}
            <SortDropdown
              options={sortOptions}
              value={sortBy}
              onChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}
            />

            {/* In-Drying quick filter chip */}
            <Button
              variant={dryingOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDryingOnly(!dryingOnly)}
              className={dryingOnly ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}
              title={dryingOnly ? 'Showing only records still in drying — click to clear' : 'Show only records currently in drying'}
            >
              ☀ In Drying {dryingOnly && <X className="h-3 w-3 ml-1" />}
            </Button>

            {/* Share Button */}
            <ShareFilterButton filters={filters} />

            {/* Export - Hidden on Mobile */}
            <div className="ml-auto hidden sm:block">
              <ExportButton
                  onExportExcel={() => exportStorageRecordsToExcel(filteredRecords, 'excel')}
                  onExportPdf={() => exportStorageRecordsToExcel(filteredRecords, 'pdf')}
                  onExportTally={handleExportTally}
                  label="Export View"
                  variant="outline"
              />
            </div>
          </div>
        </div>
        </div>

        {/* Floating Action Bar - Hidden on Mobile */}
        {selectedRecords.size > 0 && (
            <div className="hidden md:flex fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white dark:bg-card border shadow-lg rounded-full px-6 py-2 z-50 items-center gap-4 animate-in slide-in-from-bottom-5">
                <span className="text-sm font-medium">{selectedRecords.size} selected</span>
                <div className="h4 w-px bg-border" />
                <Button size="sm" onClick={handlePrintLabels}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print Labels
                </Button>
                <ExportButton
                    onExportExcel={handleExportExcel}
                    onExportPdf={handleExportPdf}
                    onExportTally={handleExportTally}
                    label="Export"
                    variant="outline"
                />
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full ml-2"
                    onClick={() => setSelectedRecords(new Set())}
                >
                    <span className="sr-only">Clear selection</span>
                    <ArrowDown className="h-4 w-4 rotate-180" />
                </Button>
            </div>
        )}
        
        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {filteredRecords.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title={query ? "No results found" : "No active storage records"}
              description={query ? `No records match "${query}".` : "Get started by adding your first inflow."}
              actionLabel={query ? undefined : "Add First Inflow"}
              actionHref={query ? undefined : "/inflow"}
            />
          ) : (
            filteredRecords.map((record) => {
              const { rent } = calculateFinalRent(record, new Date(), record.bagsStored);
              return (
                <MobileCard key={record.id}>
                  <MobileCard.Header>
                    <div className="flex-1">
                      <MobileCard.Title>{record.commodityDescription}</MobileCard.Title>
                      <p className="text-xs text-muted-foreground mt-1">
                        #{record.recordNumber} • {new Date(record.storageStartDate).toLocaleDateString()}
                      </p>
                    </div>
                    <MobileCard.Badge>{record.location}</MobileCard.Badge>
                  </MobileCard.Header>
                  <MobileCard.Content>
                    <MobileCard.Row label="Customer" value={record.customerName || 'Unknown'} />
                    <MobileCard.Row label="Bags Stored" value={record.bagsStored} />
                    <MobileCard.Row label="Rent Due" value={formatCurrency(rent)} className="text-primary font-semibold" />
                  </MobileCard.Content>
                  <MobileCard.Actions>
                    {record.inflowType === 'transfer_in' && (!record.loadBags || record.loadBags === 0) && (
                        <FinalizeDryingDialog 
                            record={{
                                id: record.id,
                                plotBags: record.plotBags,
                                bagsStored: record.bagsStored,
                                commodityDescription: record.commodityDescription,
                                hamaliPayable: record.hamaliPayable
                            }}
                        />
                    )}
                    <ActionsMenu record={record} customers={customers} crops={crops} lots={lots} userRole={userRole} />
                  </MobileCard.Actions>
                </MobileCard>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <Card className="hidden md:block">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox 
                                    checked={filteredRecords.length > 0 && selectedRecords.size === filteredRecords.length}
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                />
                            </TableHead>
                            <TableHead>Date In</TableHead>
                            <TableHead>Record #</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Commodity</TableHead>
                            <TableHead className="text-right">Bags</TableHead>
                            <TableHead className="text-right">Rent Due</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isTableLoading && filteredRecords.length === 0 ? (
                           <TableRow>
                             <TableCell colSpan={9} className="h-24 text-center">Loading...</TableCell>
                           </TableRow>
                        ) : filteredRecords.map((record) => {
                            const { rent } = calculateFinalRent(record, new Date(), record.bagsStored);
                            const isDrying = record.inflowType === 'transfer_in' && (!record.loadBags || record.loadBags === 0);
                            const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
                            const isStaleDrying = isDrying && record.storageStartDate &&
                              (Date.now() - new Date(record.storageStartDate).getTime() > SEVEN_DAYS_MS);
                            return (
                                <TableRow
                                  key={record.id}
                                  className={
                                    selectedRecords.has(record.id)
                                      ? "bg-muted/50"
                                      : isStaleDrying
                                        ? "bg-red-50/40 hover:bg-red-50/60 border-l-4 border-l-red-400"
                                        : isDrying
                                          ? "bg-amber-50/40 hover:bg-amber-50/60 border-l-4 border-l-amber-400"
                                          : ""
                                  }
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedRecords.has(record.id)}
                                            onCheckedChange={(checked) => handleSelectOne(record.id, !!checked)}
                                        />
                                    </TableCell>
                                    <TableCell>{new Date(record.storageStartDate).toLocaleDateString()}</TableCell>
                                    <TableCell className="font-medium font-mono">
                                      #{record.recordNumber}
                                      {isDrying && (
                                        <span className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isStaleDrying ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                          {isStaleDrying ? '☀ DRYING >7d' : '☀ DRYING'}
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="font-medium">{record.customerName || 'Unknown'}</TableCell>
                                    <TableCell>
                                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                        {record.location}
                                      </span>
                                    </TableCell>
                                    <TableCell>{record.commodityDescription}</TableCell>
                                    <TableCell className="text-right font-medium">
                                      {record.bagsStored}
                                      {isDrying && (
                                        <span className="block text-[10px] text-amber-700 font-normal">(plot, pending finalization)</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">{formatCurrency(rent)}</TableCell>
                                    <TableCell className="text-right flex justify-end gap-2 items-center">
                                        {record.inflowType === 'transfer_in' && (!record.loadBags || record.loadBags === 0) && (
                                            <FinalizeDryingDialog 
                                                record={{
                                                    id: record.id,
                                                    plotBags: record.plotBags,
                                                    bagsStored: record.bagsStored,
                                                    commodityDescription: record.commodityDescription,
                                                    hamaliPayable: record.hamaliPayable
                                                }}
                                            />
                                        )}
                                        <ActionsMenu record={record} customers={customers} crops={crops} lots={lots} userRole={userRole} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {!isTableLoading && filteredRecords.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="h-64">
                                    <EmptyState
                                        icon={Warehouse}
                                        title={query ? "No results found" : "No active storage records"}
                                        description={query ? `No records match "${query}".` : "Get started by adding your first inflow."}
                                        actionLabel={query ? undefined : "Add First Inflow"}
                                        actionHref={query ? undefined : "/inflow"}
                                    />
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={data?.totalCount}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={(size) => {
              pagination.setPageSize(size);
              setFilters(prev => ({ ...prev, page: 1 }));
            }}
            showPageInfo={true}
          />
        )}

    </>
  );
}
