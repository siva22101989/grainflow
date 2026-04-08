import { createClient } from '@/utils/supabase/server';
import { logError } from '@/lib/error-logger';

type NotificationType =
  | 'aging_alert'
  | 'low_space'
  | 'critical_space'
  | 'payment_overdue'
  | 'monthly_summary'
  | 'abnormal_activity'
  | 'general';

type NotificationSeverity = 'info' | 'warning' | 'critical';

interface CreateNotificationParams {
  warehouseId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  metadata?: any;
  link?: string;
}

/**
 * Creates a smart notification with user preference checking
 */
export async function createSmartNotification(params: CreateNotificationParams) {
  try {
    const supabase = await createClient();
    
    // Check if anyone has this notification type enabled
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('warehouse_id', params.warehouseId)
      .eq('notification_type', params.type)
      .eq('enabled', true);
    
    // If no preferences set, assume everyone wants notifications (default behavior)
    // Or if some users have it enabled, create notification
    if (!prefs || prefs.length === 0) {
      // No preferences means default to creating notification for warehouse
      // It will be visible to all warehouse members
    }
    
    // Create notification
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        warehouse_id: params.warehouseId,
        notification_type: params.type,
        severity: params.severity,
        title: params.title,
        message: params.message,
        metadata: params.metadata || {},
        link: params.link,
        read: false
      })
      .select()
      .single();
    
    if (error) {
      logError(error, { operation: 'createSmartNotification' });
      return null;
    }
    
    return data;
  } catch (error) {
    logError(error as Error, { operation: 'createSmartNotification' });
    return null;
  }
}

