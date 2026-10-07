'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';

import { useLoading } from '@/components/providers/loading-provider';
import { useToast } from '@/hooks/use-toast';
import { logError } from '@/lib/error-logger';

/**
 * A hook to wrap server actions with a global blocking loading state.
 * Use this when you want to "pause the screen" during an action.
 */
export function useServerAction() {
  const { showLoading, hideLoading } = useLoading();
  const { toast } = useToast();
  const [isPending, setIsPending] = React.useState(false);

  /**
   * Wraps an async server action with loading state management.
   * @param action - The async function to execute
   * @param options - Optional configuration
   */
  const runAction = async <T>(
    action: () => Promise<T>,
    options?: {
      loadingMessage?: string;
      blocking?: boolean; // If true, shows global overlay. If false (default), just sets isPending.
      onSuccess?: (data: T) => void;
      onError?: (error: any) => void;
      successMessage?: string;
      errorMessage?: string; // Custom error title or message prefix
    }
  ): Promise<T | undefined> => {
    let isRedirecting = false;
    const isBlocking = options?.blocking ?? false; // Default to non-blocking local loading

    try {
      // Force synchronous state update to ensure button renders before async action
      flushSync(() => {
        setIsPending(true);
      });
      
      if (isBlocking) {
          showLoading(options?.loadingMessage || 'Processing...');
      }

      const result = await action();
      
      
      if (options?.successMessage) {
        toast({
          title: "Success",
          description: options.successMessage,
          variant: "success" as any
        });
      }
      
      if (options?.onSuccess) {
        options.onSuccess(result);
      }
      
      return result;
    } catch (error: any) {
      if (error.message === 'NEXT_REDIRECT' || error.digest?.startsWith('NEXT_REDIRECT')) {
        isRedirecting = true;
        throw error;
      }

      logError(error, { operation: 'useServerAction' });
      toast({
          title: options?.errorMessage || "Error",
          description: error.message || 'Something went wrong',
          variant: "destructive"
      });

      if (options?.onError) {
        options.onError(error);
      }
    } finally {
      // Keep local loading state active if we are redirecting
      // This prevents the button from flashing enabled before the page changes
      if (!isRedirecting) {
        setIsPending(false);
      }
      
      // Only hide global loader if we were blocking AND not redirecting
      if (isBlocking && !isRedirecting) {
          hideLoading();
      }
    }
  };

  return { runAction, isPending };
}
