'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dismissNotificationAction } from '@/lib/actions/notification-actions';
import { useState } from 'react';
import { logError } from '@/lib/error-logger';

export function DismissNotificationButton({ notificationId }: { notificationId: string }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDismiss = async () => {
    try {
      setIsLoading(true);
      const result = await dismissNotificationAction(notificationId);
      
      if (!result.success) {
        logError(result.error, { operation: 'notifications.dismiss' });
        setIsLoading(false);
      }
      // router.refresh() is not needed because Server Action calls revalidatePath
    } catch (error) {
      logError(error, { operation: 'notifications.dismiss' });
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={handleDismiss}
      disabled={isLoading}
      title="Dismiss notification"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}
