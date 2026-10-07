'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { 
    Activity, 
    PlusCircle, 
    Edit, 
    Trash2, 
    ArrowUpCircle, 
    Search,
    ArrowLeft,
    ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { 
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { ActivityLogEntry } from '@/lib/definitions';

interface ActivityLogsTableProps {
    logs: ActivityLogEntry[];
    totalCount?: number; // Optional if we implement count query
}

export function ActivityLogsTable({ logs }: ActivityLogsTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // URL State
    const search = searchParams.get('q') || '';
    const page = Number(searchParams.get('page')) || 1;
    const filterAction = searchParams.get('type') || 'all';

    // Local State for debouncing search
    const [searchTerm, setSearchTerm] = useState(search);
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSearchTerm(search);
    }, [search]);

    // Scroll to top of table on page change
    useEffect(() => {
        // Only scroll if page > 1 to avoid jumps on initial load, 
        // or checking if it validates the "next" click requirement.
        // Actually, scrolling on any page change (even back to 1) is good UX for pagination.
        if (page > 0) {
            tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [page]);

    // Update URL on search change (debounce manual?)
    // For now, simpler: user presses Enter or handled via timeout
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (searchTerm !== search) {
                updateUrl(searchTerm, page, filterAction); // Reset to page 1? usually yes
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [searchTerm]);

    const updateUrl = (q: string, p: number, type: string) => {
        const newParams = new URLSearchParams(searchParams.toString());
        if (q) newParams.set('q', q); else newParams.delete('q');
        if (p > 1) newParams.set('page', p.toString()); else newParams.delete('page');
        if (type && type !== 'all') newParams.set('type', type); else newParams.delete('type');
        
        router.push(`?${newParams.toString()}`, { scroll: false });
    };

    const handleFilterChange = (val: string) => {
        updateUrl(searchTerm, 1, val);
    };

    const handleNext = () => {
        updateUrl(searchTerm, page + 1, filterAction);
    };

    const handlePrev = () => {
        if (page > 1) updateUrl(searchTerm, page - 1, filterAction);
    };

    const getActionIcon = (action: string) => {
        switch (action?.toUpperCase()) {
            case 'CREATE': return <PlusCircle className="h-4 w-4 text-emerald-500" />;
            case 'UPDATE': return <Edit className="h-4 w-4 text-blue-500" />;
            case 'DELETE': return <Trash2 className="h-4 w-4 text-rose-500" />;
            case 'LOGIN': return <ArrowUpCircle className="h-4 w-4 text-indigo-500" />;
            default: return <Activity className="h-4 w-4 text-slate-500" />;
        }
    };

    const formatActionMessage = (log: ActivityLogEntry) => {
        const details = log.details || {};
        const action = log.action?.toUpperCase();
        const entity = log.entity;

        if (action === 'CREATE' && entity === 'StorageRecord') {
            return `Added ${details.bags || '?'} bags of ${details.commodity || 'stock'}`;
        }
        if (action === 'UPDATE' && entity === 'StorageRecord') {
            return `Updated storage record ${log.entity_id.slice(0,8)}`;
        }
        if (action === 'DELETE' && entity === 'StorageRecord') {
            return `Deleted storage record ${log.entity_id.slice(0,8)}`;
        }
        
        // Generic fallback
        return `${log.action} ${log.entity} (${log.entity_id.slice(0,8)})`;
    };

    return (
        <div className="space-y-4" ref={tableRef}>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search logs..." 
                        className="pl-9 h-9"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select value={filterAction} onValueChange={handleFilterChange}>
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue placeholder="Action Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="important">Important Actions</SelectItem>
                            <SelectItem value="all">All Actions</SelectItem>
                            <SelectItem value="CREATE">Create</SelectItem>
                            <SelectItem value="UPDATE">Update</SelectItem>
                            <SelectItem value="DELETE">Delete</SelectItem>
                            <SelectItem value="LOGIN">Login</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border bg-card overflow-x-auto">
                <Table className="min-w-[600px] md:min-w-0">
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[180px]">User</TableHead>
                            <TableHead className="w-[120px]">Action</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead className="w-[150px]">Warehouse</TableHead>
                            <TableHead className="w-[160px] text-right">Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No activity found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow key={log.id} className="hover:bg-muted/50">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">{log.user?.full_name || 'System'}</span>
                                            <span className="text-xs text-muted-foreground">{log.user?.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getActionIcon(log.action)}
                                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal uppercase">
                                                {log.action}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-sm">
                                            <span className="font-medium">{log.entity}</span>
                                            <span className="text-muted-foreground line-clamp-1" title={formatActionMessage(log)}>
                                                {formatActionMessage(log)}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            {log.warehouse?.name || '—'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap text-sm text-muted-foreground">
                                        {format(new Date(log.created_at), 'dd MMM yyyy, h:mm a')}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {logs.length === 0 ? (
                    <div className="rounded-md border p-8 text-center text-muted-foreground bg-card">
                        No activity found.
                    </div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="rounded-lg border bg-card p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm truncate">
                                            {log.user?.full_name || 'System'}
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground truncate">
                                        {log.user?.email}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {getActionIcon(log.action)}
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal uppercase">
                                        {log.action}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium">{log.entity}</span>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {format(new Date(log.created_at), 'dd MMM yyyy, h:mm a')}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {formatActionMessage(log)}
                                </p>
                            </div>
                            
                            {log.warehouse && (
                                <div className="pt-2 border-t mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Warehouse:</span>
                                    <span className="font-medium">{log.warehouse.name}</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-2">
                 <div className="text-xs text-muted-foreground">
                    Page {page}
                 </div>
                 <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrev} disabled={page <= 1} className="h-8 w-8 p-0">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleNext} disabled={logs.length < 50} className="h-8 w-8 p-0">
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                 </div>
            </div>
        </div>
    );
}
