'use server';

import { createClient } from '@/utils/supabase/server';
import { logError } from '@/lib/error-logger';
import { revalidatePath } from 'next/cache';

/**
 * Dismiss a notification
 */
export async function dismissNotificationAction(notificationId: string) {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', notificationId);
    
    if (error) {
      logError(error, { operation: 'dismissNotificationAction' });
      return {
        success: false,
        error: 'Failed to dismiss notification'
      };
    }
    
    revalidatePath('/notifications');
    return {
      success: true,
      message: 'Notification dismissed successfully'
    };
  } catch (error) {
    logError(error as Error, { operation: 'dismissNotificationAction' });
    return {
      success: false,
      error: 'Failed to dismiss notification'
    };
  }
}
