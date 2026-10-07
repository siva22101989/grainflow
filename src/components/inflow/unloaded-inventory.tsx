import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';

interface UnloadedInventoryProps {
    records: Array<{
        id: string;
        unload_date: string;
        customer: { name: string };
        commodity_description: string;
        bags_unloaded: number;
        bags_remaining: number;
        lorry_tractor_no?: string;
    }>;
    onMoveToStorage?: (id: string) => void;
}

export function UnloadedInventory({ records, onMoveToStorage }: UnloadedInventoryProps) {
    if (records.length === 0) {
        return (
            <Card>
                 <CardContent>
                    <EmptyState
                        icon={Package}
                        title="Unloaded Inventory"
                        description="No pending bags waiting for assignment."
                    />
                 </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Unloaded Inventory
                </CardTitle>
                <CardDescription>
                    Bags unloaded but not yet assigned to plot or storage
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {records.map((record) => (
                        <div
                            key={record.id}
                            className="p-4 border rounded-lg hover:bg-accent/50 transition-colors space-y-2 relative group"
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-semibold text-sm sm:text-base">{record.customer.name}</h4>
                                        <Badge variant="secondary" className="text-xs">
                                            {record.bags_remaining} bags
                                        </Badge>
                                    </div>
                                    <p className="text-xs sm:text-sm text-muted-foreground break-words">
                                        {record.commodity_description}
                                    </p>
                                </div>
                                {onMoveToStorage && (
                                    <Button 
                                        size="sm" 
                                        variant="default" 
                                        onClick={() => onMoveToStorage(record.id)}
                                        className="h-8 text-xs shrink-0"
                                    >
                                        Store
                                    </Button>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>{formatDate(record.unload_date)}</span>
                                {record.lorry_tractor_no && (
                                    <span className="break-all">{record.lorry_tractor_no}</span>
                                )}
                            </div>
                            {record.bags_remaining < record.bags_unloaded && (
                                <p className="text-xs text-muted-foreground">
                                    {record.bags_unloaded - record.bags_remaining} bags already assigned
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
