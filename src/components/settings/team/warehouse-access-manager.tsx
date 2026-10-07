'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Building2, Globe, Loader2 } from "lucide-react";
import { toggleWarehouseAccess, getMemberAssignments, updateStaffRoleInWarehouse } from "@/lib/staff-actions";
import { getUserWarehouses } from "@/lib/warehouse-actions"; 
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logError } from '@/lib/error-logger';

interface WarehouseAccessManagerProps {
    userId: string;
}

export function WarehouseAccessManager({ userId }: WarehouseAccessManagerProps) {
    const [allWarehouses, setAllWarehouses] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<{warehouse_id: string, role: string}[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const loadData = async () => {
            try {
                const [warehouses, userAssignments] = await Promise.all([
                    getUserWarehouses(),
                    getMemberAssignments(userId)
                ]);
                setAllWarehouses(warehouses);
                setAssignments(userAssignments);
            } catch (error) {
                logError(error, { operation: 'warehouseAccessManager.load' });
                toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };
        if (userId) {
             loadData();
        }
    }, [userId, toast]);

    const handleRoleChange = async (warehouseId: string, newRole: string) => {
        setProcessingId(warehouseId);
        const previousAssignments = [...assignments];
        
        // Optimistic Update
        setAssignments(prev => prev.map(a => 
            a.warehouse_id === warehouseId ? { ...a, role: newRole } : a
        ));

        try {
            const result = await updateStaffRoleInWarehouse(userId, warehouseId, newRole);
            if (result.success) {
                toast({ title: "Role Updated", description: result.message });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                setAssignments(previousAssignments);
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to update role", variant: "destructive" });
            setAssignments(previousAssignments);
        } finally {
            setProcessingId(null);
        }
    };

    const handleToggle = async (warehouseId: string) => {
        // ... existing handleToggle logic ...
        setProcessingId(warehouseId);
        
        const previousAssignments = [...assignments];
        const isAssigned = assignments.some(a => a.warehouse_id === warehouseId);
        
        if (isAssigned) {
            setAssignments(prev => prev.filter(a => a.warehouse_id !== warehouseId));
        } else {
            setAssignments(prev => [...prev, { warehouse_id: warehouseId, role: 'staff' }]);
        }

        try {
            const result = await toggleWarehouseAccess(userId, warehouseId);
            if (result.success) {
                toast({ title: "Success", description: result.message });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                setAssignments(previousAssignments);
            }
        } catch (error) {
            toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
            setAssignments(previousAssignments);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-lg">Warehouse Access</CardTitle>
                <CardDescription>
                    Manage which warehouses this team member can access and their role in each.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
                {allWarehouses.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No additional warehouses found.</p>
                ) : (
                    <div className="grid gap-4">
                        {allWarehouses.map((uw) => {
                            const assignment = assignments.find(a => a.warehouse_id === uw.id);
                            const isAssigned = !!assignment;
                            const isProcessing = processingId === uw.id;
                            
                            return (
                                <div 
                                    key={uw.id} 
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                            <Building2 className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{uw.name || 'Unnamed Warehouse'}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Globe className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground">{uw.location || 'No location set'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {isAssigned && (
                                            <Select 
                                                value={assignment.role} 
                                                onValueChange={(val) => handleRoleChange(uw.id, val)}
                                                disabled={isProcessing}
                                            >
                                                <SelectTrigger className="h-8 w-[100px] text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="staff">Staff</SelectItem>
                                                        <SelectItem value="manager">Manager</SelectItem>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                        <SelectItem value="owner">Owner</SelectItem>
                                                    </SelectContent>
                                            </Select>
                                        )}
                                        <Switch 
                                            checked={isAssigned} 
                                            onCheckedChange={() => handleToggle(uw.id)}
                                            disabled={isProcessing}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
