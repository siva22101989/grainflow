'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
    MoreHorizontal,
    Building2,
    MapPin,
    Package,
    ExternalLink,
    Search,
    Zap,
    AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { exportToExcel } from "@/lib/export-utils";
import { exportToPdf } from "@/lib/export-pdf-utils";
import { ExportButton } from "@/components/shared/export-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { deleteWarehouseAction, assignWarehousePlan } from "@/lib/admin-actions";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AdminWarehousesTableProps {
    warehouses: any[];
}

function AdminWarehousesTableComponent({ warehouses }: AdminWarehousesTableProps) {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState<{id: string, name: string, tier?: string} | null>(null);
    const [newTier, setNewTier] = useState<string>("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [plans, setPlans] = useState<any[]>([]);
    
    // Debounce search query to reduce filtering operations
    const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

    // Memoize filtered warehouses to prevent recalculation on every render
    const filteredWarehouses = useMemo(() => {
        return warehouses.filter(w => 
            w.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            (w.location && w.location.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) ||
            (w.email && w.email.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
        );
    }, [warehouses, debouncedSearchQuery]);

    // Fetch plans on component mount
    useEffect(() => {
        async function fetchPlans() {
            try {
                const { getAllPlans } = await import('@/lib/subscription-actions');
                const data = await getAllPlans();

                setPlans(data);
            } catch (err) {
                console.error('Failed to load plans:', err);
            }
        }
        fetchPlans();
    }, []);

    // Memoize delete handler to prevent recreation on every render
    const handleDelete = useCallback(async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;
        
        const result = await deleteWarehouseAction(id);
        if (result.success) {
            toast({
                title: "Success",
                description: "Warehouse deleted",
            });
        } else {
            toast({
                title: "Error",
                description: result.message,
                variant: "destructive",
            });
        }
    }, [toast]);
    
    // Plan update handler
    const handleUpdatePlan = async () => {
        if (!selectedWarehouse || !newTier) return;
        
        setIsUpdating(true);
        try {
            const result = await assignWarehousePlan(selectedWarehouse.id, newTier);
            if (result.success) {
                toast({ title: "Plan Updated", description: result.message });
                setIsPlanModalOpen(false);
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } finally {
            setIsUpdating(false);
        }
    };

    // Memoize export handler — supports both Excel and PDF.
    const handleExport = useCallback((fmt: 'excel' | 'pdf' = 'excel') => {
        const data = filteredWarehouses.map(w => ({
            'Name': w.name,
            'Location': w.location || 'N/A',
            'Stock (Bags)': w.totalStock,
            'Capacity (Bags)': w.totalCapacity,
            'Occupancy Rate (%)': w.occupancyRate.toFixed(2),
            'Active Records': w.activeRecords,
            'Created At': format(new Date(w.created_at), 'yyyy-MM-dd')
        }));
        const filename = `warehouses_export_${new Date().getTime()}`;
        if (fmt === 'pdf') {
            exportToPdf(data, filename, 'Warehouses');
        } else {
            exportToExcel(data, filename, 'Warehouses');
        }
        toast({ title: "Export Started", description: "Your warehouse data is being downloaded." });
    }, [filteredWarehouses, toast]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search warehouses..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <ExportButton
                    onExportExcel={() => handleExport('excel')}
                    onExportPdf={() => handleExport('pdf')}
                    label="Export"
                />
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border bg-card overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow className="hover:bg-muted/50">
                        <TableHead className="w-[250px]">Warehouse</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Utilization</TableHead>
                        <TableHead>Active Records</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredWarehouses.map((w) => (
                        <TableRow key={w.id}>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-slate-400" />
                                    <div>
                                        <p>{w.name}</p>
                                        <p className="text-xs text-muted-foreground font-normal">{w.email || w.phone || 'No contact'}</p>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {w.location || 'N/A'}
                                </div>
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span>{w.totalStock.toLocaleString()} / {w.totalCapacity.toLocaleString()}</span>
                                        <span className={w.occupancyRate > 90 ? "text-rose-600 font-bold" : ""}>
                                            {w.occupancyRate.toFixed(1)}%
                                        </span>
                                    </div>
                                    <Progress value={w.occupancyRate} className="h-1.5" />
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary" className="gap-1">
                                    <Package className="h-3 w-3" />
                                    {w.activeRecords}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(w.created_at), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem asChild>
                                            <Link href={`/#warehouse-${w.id}`} className="flex items-center">
                                                <ExternalLink className="mr-2 h-4 w-4" /> View Dashboard
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => {
                                            setSelectedWarehouse({ id: w.id, name: w.name, tier: w.subscription?.plans?.tier });
                                            setNewTier(w.subscription?.plans?.tier || 'free');
                                            setIsPlanModalOpen(true);
                                        }}>
                                            <Zap className="mr-2 h-4 w-4" /> Change Plan
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => handleDelete(w.id, w.name)}>
                                            Delete Warehouse
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {filteredWarehouses.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                No warehouses found matching "{debouncedSearchQuery}"
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
            {filteredWarehouses.map((w) => (
                <Card key={w.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="bg-indigo-100 p-2 rounded-lg shrink-0">
                                    <Building2 className="h-4 w-4 text-indigo-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-sm truncate">{w.name}</h3>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {w.email || w.phone || 'No contact'}
                                    </p>
                                </div>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/#warehouse-${w.id}`} className="flex items-center">
                                            <ExternalLink className="mr-2 h-4 w-4" /> View Dashboard
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                        className="text-rose-600 focus:text-rose-600" 
                                        onClick={() => handleDelete(w.id, w.name)}
                                    >
                                        Delete Warehouse
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span>{w.location || 'N/A'}</span>
                        </div>

                        {/* Utilization */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600">Utilization</span>
                                <span className={`font-semibold ${w.occupancyRate > 90 ? "text-rose-600" : "text-slate-900"}`}>
                                    {w.occupancyRate.toFixed(1)}%
                                </span>
                            </div>
                            <Progress value={w.occupancyRate} className="h-2" />
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>{w.totalStock.toLocaleString()} bags</span>
                                <span>{w.totalCapacity.toLocaleString()} capacity</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t">
                            <Badge variant="secondary" className="gap-1">
                                <Package className="h-3 w-3" />
                                {w.activeRecords} active
                            </Badge>
                            <span className="text-xs text-slate-500">
                                {format(new Date(w.created_at), 'MMM d, yyyy')}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            ))}
            {filteredWarehouses.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center text-slate-500">
                        No warehouses found matching "{debouncedSearchQuery}"
                    </CardContent>
                </Card>
            )}
        </div>
        
        {/* Plan Change Modal */}
        <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update Subscription Plan</DialogTitle>
                    <DialogDescription>
                        Manually change the plan tier for <strong>{selectedWarehouse?.name}</strong>.
                    </DialogDescription>
                </DialogHeader>
                
                {/* Grace Period Warning */}
                {(selectedWarehouse as any)?.subscription?.status === 'grace_period' && (
                    <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertTitle className="text-orange-900 dark:text-orange-100">Grace Period Active</AlertTitle>
                        <AlertDescription className="text-orange-800 dark:text-orange-200">
                            This subscription is in grace period until{' '}
                            {(selectedWarehouse as any)?.subscription?.grace_period_end && 
                                new Date((selectedWarehouse as any).subscription.grace_period_end).toLocaleDateString()}.
                            Updating to an active plan will clear the grace period.
                        </AlertDescription>
                    </Alert>
                )}
                
                <div className="space-y-4 py-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Select Plan</label>
                        <Select value={newTier} onValueChange={setNewTier}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a plan tier" />
                            </SelectTrigger>
                            <SelectContent>
                                {plans.length === 0 ? (
                                    <>
                                        <SelectItem value="free">Free Tier</SelectItem>
                                        <SelectItem value="starter">Starter Plan</SelectItem>
                                        <SelectItem value="professional">Professional Plan</SelectItem>
                                        <SelectItem value="enterprise">Enterprise Plan</SelectItem>
                                    </>
                                ) : (
                                    plans.map(plan => {
                                        const durationLabel = 
                                            plan.duration_days === 0 || !plan.duration_days 
                                                ? 'No expiry' 
                                                : plan.duration_days === 30 
                                                ? 'Monthly' 
                                                : plan.duration_days === 365 
                                                ? 'Yearly'
                                                : `${plan.duration_days} days`;
                                        
                                        // Only show the label if it's not already part of the name
                                        const nameHasDuration = plan.name.toLowerCase().includes(durationLabel.toLowerCase());

                                        return (
                                            <SelectItem key={plan.tier} value={plan.tier}>
                                                <div className="flex items-center justify-between w-full">
                                                    <span>{plan.name}</span>
                                                    {!nameHasDuration && (
                                                        <span className="text-xs text-muted-foreground ml-4">
                                                            {durationLabel}
                                                        </span>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        );
                                    })
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {newTier && plans.find(p => p.tier === newTier) && (
                        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                            <p className="font-medium mb-1">Plan Details:</p>
                            <p>
                                Duration: <strong>
                                    {(() => {
                                        const selectedPlan = plans.find(p => p.tier === newTier);
                                        if (!selectedPlan?.duration_days || selectedPlan.duration_days === 0) return 'Unlimited (No expiry)';
                                        if (selectedPlan.duration_days === 30) return '30 days (Monthly)';
                                        if (selectedPlan.duration_days === 365) return '365 days (Yearly)';
                                        return `${selectedPlan.duration_days} days`;
                                    })()}
                                </strong>
                            </p>
                            <p className="text-xs mt-1">
                                {newTier !== 'free' && 'Subscription will expire on: ' + new Date(Date.now() + (plans.find(p => p.tier === newTier)?.duration_days || 0) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                            </p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPlanModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpdatePlan} disabled={isUpdating}>
                        {isUpdating ? "Updating..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
    );
}

// Wrap with React.memo to prevent unnecessary re-renders
// Custom comparison function to only re-render when warehouses data actually changes
export const AdminWarehousesTable = React.memo(
    AdminWarehousesTableComponent,
    (prevProps, nextProps) => {
        // Only re-render if warehouses array reference or length changes
        return prevProps.warehouses === nextProps.warehouses;
    }
);

AdminWarehousesTable.displayName = 'AdminWarehousesTable';
