'use client';

import { format } from "date-fns";
import { 
    Activity, 
    PlusCircle, 
    Edit, 
    Trash2, 
    ArrowUpCircle, 
    User, 
    Building,
    ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface GlobalActivityFeedProps {
    logs: any[];
}

export function GlobalActivityFeed({ logs }: GlobalActivityFeedProps) {
    const getActionIcon = (action: string) => {
        switch (action.toUpperCase()) {
            case 'CREATE': return <PlusCircle className="h-4 w-4 text-green-500" />;
            case 'UPDATE': return <Edit className="h-4 w-4 text-blue-500" />;
            case 'DELETE': return <Trash2 className="h-4 w-4 text-rose-500" />;
            case 'LOGIN': return <ArrowUpCircle className="h-4 w-4 text-indigo-500" />;
            default: return <Activity className="h-4 w-4 text-slate-500" />;
        }
    };

    const formatActionMessage = (log: any) => {
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
        
        return `${log.action} ${log.entity} (${log.entity_id.slice(0,8)})`;
    };

    return (
        <div className="space-y-4">
            <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {logs.map((log) => (
                    <div key={log.id} className="relative flex items-start gap-4 pl-10 md:pl-12">
                        {/* Status Icon */}
                        <div className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white border shadow-sm ring-8 ring-white z-10 mr-4">
                            {getActionIcon(log.action)}
                        </div>

                        <div className="flex-1 space-y-1 py-1">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-sm font-semibold text-slate-900">{log.user?.full_name || 'System'}</span>
                                    <Badge variant="outline" className="text-[10px] h-4 px-1 leading-none uppercase tracking-wider text-slate-500">
                                        {log.action}
                                    </Badge>
                                    <span className="text-sm text-slate-600">
                                        {formatActionMessage(log)}
                                    </span>
                                </div>
                                <span className="text-xs text-slate-400 whitespace-nowrap">
                                    {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm')}
                                </span>
                            </div>

                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1 text-slate-500">
                                    <User className="h-3 w-3" />
                                    {log.user?.email || 'N/A'}
                                </div>
                                <div className="flex items-center gap-1 text-slate-500">
                                    <Building className="h-3 w-3" />
                                    {log.warehouse?.name || 'N/A'}
                                </div>
                                <Button variant="link" className="h-auto p-0 text-[11px] text-indigo-600 font-medium gap-1" asChild>
                                    <Link href={`/#action-${log.id}`}>
                                        View Details <ExternalLink className="h-2 w-2" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
                
                {logs.length === 0 && (
                    <div className="py-8 text-center text-slate-400 italic text-sm">
                        No activity recorded yet across the platform.
                    </div>
                )}
            </div>
            
            {logs.length > 0 && (
                <div className="flex justify-center pt-4">
                    <Button variant="outline" size="sm" className="text-xs">
                        Load More Activity
                    </Button>
                </div>
            )}
        </div>
    );
}
