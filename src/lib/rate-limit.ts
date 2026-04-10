import { createClient } from '@/utils/supabase/server';
import { logError } from './error-logger';

interface RateLimitOptions {
  limit?: number; // Max requests
  windowMs?: number; // Time window in milliseconds
  failClosed?: boolean; // If true, block requests when rate limiter DB is down
}

/**
 * Distributed rate limiter using Supabase/Postgres.
 * Uses the `check_rate_limit` RPC function.
 */
export async function rateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): Promise<{ success: boolean }> {
  const { limit = 10, windowMs = 60000, failClosed = false } = options;
  const windowSeconds = Math.ceil(windowMs / 1000);
  
  try {
    const supabase = await createClient();
    
    // We use a safe key format
    const key = `ratelimit:${identifier}`;
    
    const { data: success, error } = await supabase.rpc('check_rate_limit', {
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds
    });

    if (error) {
        logError(error, { operation: 'checkRateLimit_rpc', metadata: { identifier } });
        // Fail open by default, fail closed for security-critical paths (webhooks, auth)
        return { success: !failClosed };
    }

    return { success: !!success };

  } catch (error) {
     logError(error, { operation: 'checkRateLimit_fatal', metadata: { identifier } });
     return { success: !failClosed };
  }
}

/**
 * Helper to apply rate limiting to a server action.
 * Throws an error if rate limit is exceeded.
 */
export async function checkRateLimit(
  identifier: string,
  actionName: string,
  options: RateLimitOptions = {}
) {
  const result = await rateLimit(`${actionName}:${identifier}`, options);
  
  if (!result.success) {
    throw new Error('Too many requests. Please try again later.');
  }
  
  return result;
}
