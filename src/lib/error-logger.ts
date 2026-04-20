import * as Sentry from '@sentry/nextjs';

/**
 * Centralized error logging utility
 * Use this instead of console.error in production code
 */

export function logError(
  error: unknown,
  context?: {
    operation?: string;
    userId?: string;
    warehouseId?: string;
    metadata?: Record<string, any>;
  }
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  Sentry.captureException(error, {
    tags: {
      operation: context?.operation,
    },
    user: context?.userId ? { id: context.userId } : undefined,
    extra: {
      warehouseId: context?.warehouseId,
      ...context?.metadata,
    },
  });

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context?.operation || 'Error'}]:`, errorMessage, context?.metadata);
  }
}

export function logWarning(
  message: string,
  context?: {
    operation?: string;
    metadata?: Record<string, any>;
  }
) {
  Sentry.captureMessage(message, {
    level: 'warning',
    tags: {
      operation: context?.operation,
    },
    extra: context?.metadata,
  });

  if (process.env.NODE_ENV === 'development') {
    console.warn(`[${context?.operation || 'Warning'}]:`, message, context?.metadata);
  }
}

/**
 * Extract a user-readable error message from any thrown value.
 *
 * Supabase PostgrestError is NOT `instanceof Error`, so the common pattern
 * `error instanceof Error ? error.message : String(error)` results in
 * "[object Object]" in toasts. This helper handles all common cases:
 * - Standard Error: returns .message
 * - Supabase PostgrestError: returns .message, falls back to .details, then .hint
 * - Plain string: returns as-is
 * - Anything else: returns the fallback message
 */
export function formatActionError(error: unknown, fallback = 'An unexpected error occurred. Please try again.'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  const e = error as any;
  return String(e?.message || e?.details || e?.hint || fallback);
}
