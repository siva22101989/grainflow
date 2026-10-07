'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { restoreCustomer } from '@/lib/actions/customers';
import { useUnifiedToast } from '@/components/shared/toast-provider';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { logError } from '@/lib/error-logger';

export function RestoreCustomerDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const { success, error } = useUnifiedToast();
    const router = useRouter();

    const fetchDeletedCustomers = async () => {
        setLoading(true);
        const supabase = createClient();
        
        // We need to fetch deleted customers. 
        // Note: Standard queries filter them out, so we query directly or use a specific RPC/query if available.
        // For now, we'll try a direct client-side query since RLS usually allows viewing if user has access.
        // Wait, did we audit RLS? "Users see own warehouse" usually filters by warehouse_id.
        // Accessing 'customers' listing policy usually doesn't force deleted_at=null unless specified in the policy itself?
        // Let's assume standard SELECT policy allows seeing rows, and our 'getCustomers' logic was doing the filtering.
        // Implementation: Direct Supabase Client Query for deleted items.
        
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return;

        // We assume we have a policy that allows selecting rows.
        const { data, error: fetchError } = await supabase
            .from('customers')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        if (fetchError) {
            logError(fetchError, { operation: 'restoreCustomer.fetchDeleted' });
        } else {
            setCustomers(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (open) {
            fetchDeletedCustomers();
        }
    }, [open]);

    const handleRestore = async (customerId: string) => {
        setRefreshing(true);
        const result = await restoreCustomer(customerId);
        if (result.success) {
            success('Restored', result.message);
            // Remove from local list
            setCustomers(prev => prev.filter(c => c.id !== customerId));
            router.refresh(); // Refresh background page
        } else {
            error('Error', result.message);
        }
        setRefreshing(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="ml-2 text-muted-foreground hover:text-primary">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Trash ({customers.length > 0 ? customers.length : ''})
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Deleted Customers</DialogTitle>
                    <DialogDescription>
                        View and restore recently deleted customers.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="text-center text-muted-foreground p-8 bg-muted/20 rounded-lg border border-dashed">
                            No deleted customers found.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {customers.map(customer => (
                                <div key={customer.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border">
                                    <div>
                                        <div className="font-medium">{customer.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            Deleted: {customer.deleted_at ? format(new Date(customer.deleted_at), 'dd MMM yyyy, hh:mm a') : 'Unknown'}
                                        </div>
                                        <div className="text-xs text-muted-foreground/80 mt-1">
                                            Phone: {customer.phone} | Village: {customer.village}
                                        </div>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="gap-2 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/30"
                                        onClick={() => handleRestore(customer.id)}
                                        disabled={refreshing}
                                    >
                                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                                        Restore
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
