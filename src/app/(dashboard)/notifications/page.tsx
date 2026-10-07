import { createClient } from '@/utils/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, Package, Warehouse, DollarSign, TrendingUp, Search, Info } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { DismissNotificationButton } from './dismiss-button';
import { logError } from '@/lib/error-logger';

export const metadata = {
  title: 'Notifications',
  description: 'View your smart notifications and alerts.',
};

// Notification type icons
const TYPE_ICONS = {
  aging_alert: Package,
  low_space: Warehouse,
  critical_space: Warehouse,
  payment_overdue: DollarSign,
  monthly_summary: TrendingUp,
  abnormal_activity: Search,
  general: Info
};

// Notification type friendly names
const TYPE_NAMES = {
  aging_alert: 'Aging Alert',
  low_space: 'Low Space',
  critical_space: 'Critical Space',
  payment_overdue: 'Payment Overdue',
  monthly_summary: 'Monthly Summary',
  abnormal_activity: 'Abnormal Activity',
  general: 'General'
};

async function getNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  // Fetch notifications with new fields
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .is('dismissed_at', null) // Don't show dismissed
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    logError(error, { operation: 'notificationsPage.fetch' });
    return [];
  }

  // Check read status
  const { data: reads } = await supabase
    .from('notification_reads')
    .select('notification_id')
    .eq('user_id', user.id);

  const readSet = new Set(reads?.map(r => r.notification_id));

  return notifications.map(n => ({
    ...n,
    read: readSet.has(n.id)
  }));
}

export default async function NotificationsPage() {
  const notifications = await getNotifications();

  // Group by severity
  const critical = notifications.filter(n => n.severity === 'critical');
  const warning = notifications.filter(n => n.severity === 'warning');
  const info = notifications.filter(n => n.severity === 'info' || !n.severity);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart Notifications"
        description="Automated alerts and business insights."
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Notifications' }
        ]}
      />

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mb-4 opacity-20" />
            <p>No notifications at this time.</p>
            <p className="text-sm mt-2">You'll be notified of important events automatically.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Critical Notifications */}
          {critical.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Critical ({critical.length})
              </h2>
              {critical.map((note) => (
                <NotificationCard key={note.id} notification={note} severityColor="red" />
              ))}
            </div>
          )}

          {/* Warning Notifications */}
          {warning.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-orange-600">Warning ({warning.length})</h2>
              {warning.map((note) => (
                <NotificationCard key={note.id} notification={note} severityColor="orange" />
              ))}
            </div>
          )}

          {/* Info Notifications */}
          {info.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-blue-600">Information ({info.length})</h2>
              {info.map((note) => (
                <NotificationCard key={note.id} notification={note} severityColor="blue" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationCard({ notification, severityColor }: { notification: any; severityColor: string }) {
  const Icon = TYPE_ICONS[notification.notification_type as keyof typeof TYPE_ICONS] || Info;
  const typeName = TYPE_NAMES[notification.notification_type as keyof typeof TYPE_NAMES] || 'Notification';

  const colorClasses = {
    red: {
      bg: 'bg-red-100',
      text: 'text-red-600',
      border: 'border-red-200',
      badge: 'bg-red-100 text-red-800'
    },
    orange: {
      bg: 'bg-orange-100',
      text: 'text-orange-600',
      border: 'border-orange-200',
      badge: 'bg-orange-100 text-orange-800'
    },
    blue: {
      bg: 'bg-blue-100',
      text: 'text-blue-600',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-800'
    }
  };

  const colors = colorClasses[severityColor as keyof typeof colorClasses];

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      notification.read ? "opacity-70 bg-muted/30" : `border-l-4 ${colors.border}`
    )}>
      <div className="flex items-start p-4 gap-4">
        <div className={cn("p-3 rounded-lg shrink-0", colors.bg, colors.text)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base">{notification.title}</h3>
              <Badge variant="outline" className={cn("text-xs", colors.badge)}>
                {typeName}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(notification.created_at)} {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <DismissNotificationButton notificationId={notification.id} />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">{notification.message}</p>
          {notification.link && (
            <Button variant="link" className="px-0 h-auto mt-2 text-primary" asChild>
              <Link href={notification.link}>View Details &rarr;</Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
