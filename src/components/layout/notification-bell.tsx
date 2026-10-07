
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Bell, CheckCheck, ChevronRight, ChevronDown } from 'lucide-react';
import type { NotificationEntry } from '@/lib/definitions';
import { markAllNotificationsAsRead, markNotificationsAsRead, getNotificationPreferences, type NotificationPreferences } from '@/lib/notification-actions';
import { Button } from '@/components/ui/button';
import { useWarehouses } from '@/contexts/warehouse-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { logError } from '@/lib/error-logger';
import { formatDate } from '@/lib/utils';

export function NotificationBell() {
    const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
    const [hasUnread, setHasUnread] = useState(false);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    const { currentWarehouse } = useWarehouses();
    const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
    const prefsRef = useRef<NotificationPreferences | null>(null);

    const { toast } = useToast();

    // 1. Sync Prefs to Ref for Realtime Callback
    useEffect(() => {
        prefsRef.current = prefs;
    }, [prefs]);

    // 2. Fetch Prefs on Warehouse Change
    useEffect(() => {
        if (currentWarehouse) {
            getNotificationPreferences(currentWarehouse.id).then(setPrefs);
        }
    }, [currentWarehouse]);

    // Helper: Category Filtering Logic
    const shouldShow = (n: NotificationEntry, preferences: NotificationPreferences | null) => {
        if (!preferences) return true; // Default to Show if prefs missing
        if (n.user_id) return true; // Direct messages always show

        switch(n.category) {
            case 'payment': 
                if (n.title.toLowerCase().includes('due')) return preferences.pending_dues;
                return preferences.payment_received;
            case 'stock': return preferences.low_stock_alert;
            case 'inflow': return preferences.new_inflow;
            case 'outflow': return preferences.new_outflow;
            default: return true;
        }
    };

    // 3. Fetch Notifications & Subscribe
    const fetchNotes = async () => {
         try {
             const { data: { user } } = await supabase.auth.getUser();
             if (!user || !currentWarehouse) return;

             // A. Get Ids of Read Notifications
             const { data: readIds } = await supabase
                .from('notification_reads')
                .select('notification_id')
                .eq('user_id', user.id);
             
             const readNotificationIds = readIds?.map(r => r.notification_id) || [];
             
             // B. Fetch Latest Notifications (Warehouse Scoped)
             let query = supabase
                .from('notifications')
                .select('*')
                .eq('warehouse_id', currentWarehouse.id) // IMPORTANT: Scope to warehouse
                .order('created_at', { ascending: false })
                .limit(100);
             
             if (readNotificationIds.length > 0) {
                 query = query.not('id', 'in', `(${readNotificationIds.join(',')})`);
             }
             
             const { data, error } = await query;
             
             if (error) {
                 logError(error, { operation: 'notificationBell.fetch' });
                 return;
             }
             
             if (data) {
                 // Client-side filter for now (since we can't easily join prefs in simple query without extensive backend changes)
                 // Use current prefsRef (which might be null initially, but we re-fetch when prefs change below)
                 const validNotes = (data as NotificationEntry[]).filter(n => shouldShow(n, prefsRef.current));
                 setNotifications(validNotes);
                 setHasUnread(validNotes.length > 0);
             }
         } catch (err) {
             logError(err, { operation: 'notificationBell.fetch' });
         }
    };

    // Trigger fetch on mount/warehouse change AND when prefs load
    useEffect(() => {
        if (currentWarehouse) {
            fetchNotes();
        }
    }, [currentWarehouse, prefs]); // Re-run fetch logic if prefs update to apply filter

    // Realtime Subscription
    useEffect(() => {
        if (!currentWarehouse) return;

        const channel = supabase
            .channel('notifications-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications'
                },
                async (payload) => {
                    const newNotification = payload.new as NotificationEntry;
                    
                    // 1. Warehouse Check
                    if (newNotification.warehouse_id !== currentWarehouse.id) return;

                    // 2. User Check
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;
                    if (newNotification.user_id && newNotification.user_id !== user.id) return;

                    // 3. Preference Filter (Use Ref for latest state)
                    if (!shouldShow(newNotification, prefsRef.current)) {
                        return; // Ignore
                    }

                    setNotifications(prev => [newNotification, ...prev]);
                    setHasUnread(true);
                    
                    if (newNotification.type === 'warning' || newNotification.type === 'error') {
                        toast({
                            title: newNotification.title,
                            description: newNotification.message,
                            variant: newNotification.type === 'error' ? 'destructive' : 'default'
                        });
                    }
                }
            )
            .subscribe();
        
        return () => {
            channel.unsubscribe();
        };
    }, [currentWarehouse]);

    // Grouping & UI Logic
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    
    const groupedNotifications = useMemo(() => {
        const groups: Record<string, NotificationEntry[]> = {};
        notifications.forEach(n => {
            const key = `${n.type}-${n.title}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(n);
        });
        
        return Object.entries(groups)
            .map(([key, items]) => {
                const firstItem = items[0];
                return {
                    key,
                    title: firstItem?.title ?? '',
                    type: firstItem?.type ?? 'info',
                    items: items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
                    latest: firstItem,
                    count: items.length
                };
            })
            .sort((a, b) => {
                const aTime = a.latest ? new Date(a.latest.created_at).getTime() : 0;
                const bTime = b.latest ? new Date(b.latest.created_at).getTime() : 0;
                return bTime - aTime;
            });
    }, [notifications]);

    const toggleGroup = (key: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setExpandedGroups(prev => 
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const markGroupRead = async (ids: string[], e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        setNotifications(prev => {
            const updated = prev.filter(n => !ids.includes(n.id));
            setHasUnread(updated.length > 0);
            return updated;
        });

        await markNotificationsAsRead(ids);
    };

    const markRead = async (id: string, e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        setNotifications(prev => {
            const updated = prev.filter(n => n.id !== id);
            setHasUnread(updated.length > 0);
            return updated;
        });

        await markNotificationsAsRead([id]);
    };

    const markAllRead = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLoading(true);

        const oldNotes = [...notifications];
        setNotifications([]);
        setHasUnread(false);

        const result = await markAllNotificationsAsRead();
        
        if (result.error) {
             logError(result.error, { operation: 'notificationBell.markAllRead' });
             setNotifications(oldNotes);
             setHasUnread(true);
        }
        setLoading(false);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="View notifications">
                    <Bell className="h-5 w-5" />
                    {hasUnread && (
                        <span className="absolute top-1 right-2 h-2.5 w-2.5 rounded-full bg-red-600 border-2 border-background animate-pulse" />
                    )}
                </Button>
            </DropdownMenuTrigger>
             <DropdownMenuContent align="end" className="w-[380px] p-0">
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h4 className="font-semibold leading-none">Notifications</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                            {notifications.length > 0 
                                ? `You have ${notifications.length} unread ${notifications.length === 100 ? '(showing 100+)' : 'messages'}`
                                : 'No unread messages'}
                        </p>
                    </div>
                    {hasUnread && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-xs hover:bg-accent"
                            onClick={markAllRead}
                            disabled={loading}
                        >
                            <CheckCheck className="mr-2 h-3.5 w-3.5" />
                            Mark all read
                        </Button>
                    )}
                </div>
                
                <ScrollArea className="h-[400px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[200px] text-center p-4">
                            <Bell className="h-10 w-10 text-muted-foreground/20 mb-3" />
                            <p className="text-sm text-muted-foreground">Inbox zero! No new alerts</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {groupedNotifications.map((group) => {
                                const isExpanded = expandedGroups.includes(group.key);
                                const isGroup = group.count > 1;

                                if (!isGroup) {
                                    const note = group.items[0];
                                    if (!note) return null;
                                    return (
                                        <DropdownMenuItem 
                                            key={note.id} 
                                            className="flex flex-col items-start gap-1 p-4 cursor-pointer focus:bg-accent/50 border-b last:border-0 rounded-none bg-accent/5"
                                            asChild
                                        >
                                            <div className="w-full relative group">
                                                <Link href={note.link || '#'} className="w-full" onClick={() => markRead(note.id)}>
                                                    <div className="flex w-full justify-between items-start gap-2">
                                                        <div className="flex-1 space-y-1">
                                                            <p className="text-sm font-bold text-primary">
                                                                {note.title}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground w-full line-clamp-2">
                                                                {note.message}
                                                            </p>
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                                            {formatDate(note.created_at)}
                                                        </span>
                                                    </div>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute -right-2 -top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => markRead(note.id, e)}
                                                >
                                                    <CheckCheck className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </DropdownMenuItem>
                                    );
                                }

                                return (
                                    <div key={group.key} className="border-b last:border-0 bg-accent/5">
                                        <div 
                                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                                            onClick={(e) => toggleGroup(group.key, e)}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-primary truncate">
                                                        {group.title} <span className="text-xs font-normal text-muted-foreground ml-1">({group.count})</span>
                                                    </span>
                                                    {!isExpanded && (
                                                        <span className="text-xs text-muted-foreground truncate">
                                                            Latest: {group.latest?.message}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs ml-2 shrink-0"
                                                onClick={(e) => markGroupRead(group.items.map(n => n.id), e)}
                                            >
                                                Clear Group
                                            </Button>
                                        </div>
                                        
                                        {isExpanded && (
                                            <div className="bg-background/50 border-t">
                                                {group.items.map(note => (
                                                    <DropdownMenuItem 
                                                        key={note.id} 
                                                        className="flex flex-col items-start gap-1 p-3 pl-8 cursor-pointer focus:bg-accent/50 border-b last:border-0 rounded-none"
                                                        asChild
                                                    >
                                                        <Link href={note.link || '#'} className="w-full" onClick={() => markRead(note.id)}>
                                                            <div className="flex w-full justify-between items-start gap-2">
                                                                <div className="flex-1">
                                                                    <p className="text-xs text-muted-foreground w-full">
                                                                        {note.message}
                                                                    </p>
                                                                </div>
                                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                                                    {formatDate(note.created_at)}
                                                                </span>
                                                            </div>
                                                        </Link>
                                                    </DropdownMenuItem>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
                <div className="p-2 border-t flex justify-center bg-muted/5">
                    <Button variant="link" size="sm" asChild className="text-xs h-8">
                        <Link href="/notifications">View Full History</Link>
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
