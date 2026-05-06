'use client';

import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MobileCard } from "@/components/ui/mobile-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Wallet } from "lucide-react";
import { ExpenseActionsMenu } from "@/components/expenses/expense-actions-menu";
import { SearchBar } from "@/components/ui/search-bar";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { formatCurrency, toDate } from "@/lib/utils";
import type { Expense } from "@/lib/definitions";
import { FilterPopover, FilterSection, MultiSelect, NumberRangeInput, SortDropdown, ShareFilterButton, ExportButton, type MultiSelectOption, type SortOption } from '@/components/filters';
import { exportExpensesWithFilters } from "@/lib/export-utils-filtered";
import { getAppliedFiltersSummary } from "@/lib/url-filters";
import { useUrlFilters } from '@/hooks/use-url-filters';
import { usePagination } from '@/hooks/use-pagination';
import { Pagination } from '@/components/ui/pagination';

interface ExpenseFilterState {
  q: string;
  dateRange: DateRange | undefined;
  selectedCategories: string[];
  minAmount: number | null;
  maxAmount: number | null;
  sortBy: string;
}

interface ExpenseListClientProps {
    expenses: Expense[];
}

export function ExpenseListClient({ expenses }: ExpenseListClientProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [filters, setFilters] = useUrlFilters<ExpenseFilterState>({
        q: '',
        dateRange: undefined,
        selectedCategories: [],
        minAmount: null,
        maxAmount: null,
        sortBy: 'date-desc'
    });
    
    const query = filters.q;
    const dateRange = filters.dateRange;
    const selectedCategories = filters.selectedCategories;
    const minAmount = filters.minAmount;
    const maxAmount = filters.maxAmount;
    const sortBy = filters.sortBy;

    const filteredExpenses = useMemo(() => {
        let result = [...expenses];

        // Search filter
        if (query) {
            const search = query.toLowerCase();
            result = result.filter(e =>
                e.description?.toLowerCase().includes(search) ||
                e.category?.toLowerCase().includes(search)
            );
        }

        // Date filter
        if (dateRange?.from) {
            result = result.filter(e => {
                const date = toDate(e.date);
                return isWithinInterval(date, {
                    start: startOfDay(dateRange.from!),
                    end: dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!)
                });
            });
        }

        // Category filter
        if (selectedCategories.length > 0) {
            result = result.filter(e => selectedCategories.includes(e.category));
        }

        // Amount range filter
        if (minAmount !== null) result = result.filter(e => e.amount >= minAmount);
        if (maxAmount !== null) result = result.filter(e => e.amount <= maxAmount);

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'date-desc':
                    return toDate(b.date).getTime() - toDate(a.date).getTime();
                case 'date-asc':
                    return toDate(a.date).getTime() - toDate(b.date).getTime();
                case 'amount-desc':
                    return b.amount - a.amount;
                case 'amount-asc':
                    return a.amount - b.amount;
                case 'category-asc':
                    return (a.category || '').localeCompare(b.category || '');
                case 'category-desc':
                    return (b.category || '').localeCompare(a.category || '');
                default:
                    return 0;
            }
        });

        return result;
    }, [expenses, query, dateRange, selectedCategories, minAmount, maxAmount, sortBy]);

    // Pagination
    const pagination = usePagination(20);
    const [currentPage, setCurrentPage] = useState(1);
    const startIndex = (currentPage - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredExpenses.length / pagination.pageSize);

    // Prepare filter options
    const categoryOptions: MultiSelectOption[] = useMemo(() => {
        const unique = Array.from(new Set(expenses.map(e => e.category)));
        return unique.map(name => ({ label: name, value: name }));
    }, [expenses]);

    const sortOptions: SortOption[] = [
        { label: 'Newest First', value: 'date-desc', icon: 'desc' },
        { label: 'Oldest First', value: 'date-asc', icon: 'asc' },
        { label: 'Highest Amount', value: 'amount-desc', icon: 'desc' },
        { label: 'Lowest Amount', value: 'amount-asc', icon: 'asc' },
        { label: 'Category (A-Z)', value: 'category-asc', icon: 'asc' },
        { label: 'Category (Z-A)', value: 'category-desc', icon: 'desc' },
    ];

    const activeFilters = useMemo(() => {
        let count = 0;
        if (dateRange?.from) count++;
        if (selectedCategories.length > 0) count++;
        if (minAmount !== null || maxAmount !== null) count++;
        return count;
    }, [dateRange, selectedCategories, minAmount, maxAmount]);

    const handleClearFilters = () => {
        setFilters(prev => ({
            ...prev,
            dateRange: undefined,
            selectedCategories: [],
            minAmount: null,
            maxAmount: null
        }));
    };

    const handleExport = (format: 'excel' | 'pdf' = 'excel') => {
        const metadata = {
            totalRecords: expenses.length,
            filteredRecords: filteredExpenses.length,
            appliedFilters: getAppliedFiltersSummary(filters),
            exportDate: new Date()
        };
        exportExpensesWithFilters(filteredExpenses, metadata, format);
    };
    const handleExportExcel = () => handleExport('excel');
    const handleExportPdf = () => handleExport('pdf');

    return (
        <div className="mt-6 scroll-mt-20" ref={containerRef}>
            <Card>
                <CardHeader>
                    <CardTitle>Expense History</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Search and Filter Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <SearchBar
                            value={query}
                            onChange={(value) => setFilters(prev => ({ ...prev, q: value }))}
                            placeholder="Search by description or category..."
                            className="flex-1"
                        />
                        <DatePickerWithRange date={dateRange} setDate={(range) => setFilters(prev => ({ ...prev, dateRange: range }))} className="w-full sm:w-auto" />
                        <FilterPopover
                            activeFilters={activeFilters}
                            onClear={handleClearFilters}
                        >
                            <FilterSection title="Categories">
                                <MultiSelect
                                    options={categoryOptions}
                                    selected={selectedCategories}
                                    onChange={(value) => setFilters(prev => ({ ...prev, selectedCategories: value }))}
                                    placeholder="All categories"
                                />
                            </FilterSection>
                            <FilterSection title="Amount Range">
                                <NumberRangeInput
                                    min={minAmount}
                                    max={maxAmount}
                                    onMinChange={(value) => setFilters(prev => ({ ...prev, minAmount: value }))}
                                    onMaxChange={(value) => setFilters(prev => ({ ...prev, maxAmount: value }))}
                                    minPlaceholder="Min amount"
                                    maxPlaceholder="Max amount"
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
                        {paginatedExpenses.map((expense) => (
                            <MobileCard key={expense.id}>
                                <MobileCard.Header>
                                    <div className="flex-1">
                                        <MobileCard.Title>{expense.category}</MobileCard.Title>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {format(toDate(expense.date), 'dd MMM yyyy')}
                                        </p>
                                    </div>
                                    <MobileCard.Badge>{formatCurrency(expense.amount)}</MobileCard.Badge>
                                </MobileCard.Header>
                                <MobileCard.Content>
                                    <p className="text-sm font-medium">{expense.description}</p>
                                </MobileCard.Content>
                                <MobileCard.Actions>
                                    <div className="w-full flex justify-end">
                                        <ExpenseActionsMenu expense={expense} />
                                    </div>
                                </MobileCard.Actions>
                            </MobileCard>
                        ))}
                        {filteredExpenses.length === 0 && (
                            <EmptyState
                                icon={Wallet}
                                title={query || dateRange ? "No expenses found" : "No expenses recorded"}
                                description={query || dateRange ? "Try adjusting your search or date range." : "Your expense history will appear here."}
                            />
                        )}
                    </div>

                    {/* Desktop View */}
                    <Table className="hidden md:table">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedExpenses.map((expense) => (
                                <TableRow key={expense.id}>
                                    <TableCell>{format(toDate(expense.date), 'dd MMM yyyy')}</TableCell>
                                    <TableCell>{expense.category}</TableCell>
                                    <TableCell className="font-medium">{expense.description}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(expense.amount)}</TableCell>
                                    <TableCell>
                                        <ExpenseActionsMenu expense={expense} />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredExpenses.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground p-6">
                                        {query || dateRange ? "No expenses found matching your criteria." : "No expenses have been recorded yet."}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    
                    {totalPages > 1 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredExpenses.length}
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
                </CardContent>
            </Card>
        </div>
    );
}
