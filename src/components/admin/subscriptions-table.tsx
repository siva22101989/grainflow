'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { updateSubscriptionAdmin } from '@/lib/subscription-actions';
import { useUnifiedToast } from '@/components/shared/toast-provider';
import { CodeGenerator } from './code-generator';

interface SubscriptionData {
    warehouseId: string;
    warehouseName: string;
    location: string;
    subscription: {
        id: string;
        status: 'active' | 'incomplete' | 'past_due' | 'canceled' | 'unpaid';
        current_period_end: string | null;
        plan_id: string;
        plans?: {
            id: string;
            name: string;
            tier: string;
        }
    } | null;
}

interface Plan {
    id: string;
    name: string;
    tier: string;
    price: number | string;
}

interface SubscriptionsTableProps {
    initialData: SubscriptionData[];
    plans: Plan[];
}

export function SubscriptionsTable({ initialData, plans }: SubscriptionsTableProps) {
    const router = useRouter();
    const { success, error } = useUnifiedToast();
    const [selectedItem, setSelectedItem] = useState<SubscriptionData | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Form Stats
    const [editPlanId, setEditPlanId] = useState('');
    const [editStatus, setEditStatus] = useState<string>('active');
    const [editEndDate, setEditEndDate] = useState('');

    const openEdit = (item: SubscriptionData) => {
        setSelectedItem(item);
        setEditPlanId(item.subscription?.plan_id || plans[0]?.id || '');
        setEditStatus(item.subscription?.status || 'active');
        
        const endDate = item.subscription?.current_period_end;
        if (endDate) {
            setEditEndDate(new Date(endDate).toISOString().split('T')[0] || '');
        } else {
            setEditEndDate('');
        }
        
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!selectedItem) return;
        setIsLoading(true);

        const res = await updateSubscriptionAdmin(
            selectedItem.warehouseId, 
            editPlanId, 
            editStatus as any, 
            editEndDate || undefined
        );

        setIsLoading(false);
        if (res.success) {
            success("Updated", res.message);
            setIsDialogOpen(false);
            router.refresh();
        } else {
            error("Error", res.message);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'default'; // primary
            case 'incomplete': return 'secondary';
            case 'past_due': return 'destructive';
            case 'canceled': return 'outline';
            default: return 'outline';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <CodeGenerator plans={plans} />
            </div>
            
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {initialData.map((item) => (
                    <Card key={item.warehouseId}>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-sm truncate">{item.warehouseName}</h3>
                                    <p className="text-xs text-muted-foreground truncate">{item.location}</p>
                                </div>
                                <Badge variant={getStatusColor(item.subscription?.status || 'none') as any} className="shrink-0">
                                    {item.subscription?.status || 'None'}
                                </Badge>
                            </div>
                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Plan:</span>
                                    <span className="font-medium">{item.subscription?.plans?.name || 'No Plan'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Expires:</span>
                                    <span className="font-medium">
                                        {item.subscription?.current_period_end 
                                            ? format(new Date(item.subscription.current_period_end), 'MMM d, yyyy') 
                                            : '-'}
                                    </span>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => openEdit(item)} className="w-full">
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Subscription
                            </Button>
                        </CardContent>
                    </Card>
                ))}
                {initialData.length === 0 && (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            No warehouses found.
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {initialData.map((item) => (
                        <TableRow key={item.warehouseId}>
                            <TableCell>
                                <div className="font-medium">{item.warehouseName}</div>
                                <div className="text-xs text-muted-foreground">{item.location}</div>
                            </TableCell>
                            <TableCell>
                                {item.subscription?.plans?.name || 'No Plan'}
                            </TableCell>
                            <TableCell>
                                <Badge variant={getStatusColor(item.subscription?.status || 'none') as any}>
                                    {item.subscription?.status || 'None'}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {item.subscription?.current_period_end 
                                    ? format(new Date(item.subscription.current_period_end), 'MMM d, yyyy') 
                                    : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {initialData.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                No warehouses found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manage Subscription</DialogTitle>
                        <DialogDescription>
                            Edit subscription details for {selectedItem?.warehouseName}.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <Tabs defaultValue="details" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="payments">Payments</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="details" className="py-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                <Label htmlFor="plan" className="text-left sm:text-right">Plan</Label>
                                <Select value={editPlanId} onValueChange={setEditPlanId}>
                                    <SelectTrigger className="col-span-1 sm:col-span-3">
                                        <SelectValue placeholder="Select Plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {plans.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name} - {p.tier}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                <Label htmlFor="status" className="text-left sm:text-right">Status</Label>
                                <Select value={editStatus} onValueChange={setEditStatus}>
                                    <SelectTrigger className="col-span-1 sm:col-span-3">
                                        <SelectValue placeholder="Select Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="incomplete">Incomplete</SelectItem>
                                        <SelectItem value="grace_period">Grace Period</SelectItem>
                                        <SelectItem value="expired">Expired</SelectItem>
                                        <SelectItem value="past_due">Past Due</SelectItem>
                                        <SelectItem value="canceled">Canceled</SelectItem>
                                        <SelectItem value="unpaid">Unpaid</SelectItem>
                                        <SelectItem value="trailing_trial">Trialing</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                                <Label htmlFor="date" className="text-left sm:text-right">Expiry Date</Label>
                                <Input 
                                    id="date" 
                                    type="date" 
                                    className="col-span-1 sm:col-span-3" 
                                    value={editEndDate} 
                                    onChange={(e) => setEditEndDate(e.target.value)} 
                                />
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="payments" className="py-4">
                            <div className="text-sm text-center text-muted-foreground py-8 border rounded-md border-dashed">
                                Payment history will be displayed here soon.
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isLoading}>
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );


}
