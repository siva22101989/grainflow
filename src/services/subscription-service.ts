import { createClient } from '@/utils/supabase/server';
import { logError } from '@/lib/error-logger';
import { Database, UserRole, SubscriptionStatus } from '@/types/db';
import { LIMITS } from '@/lib/feature-flags';

type Subscription = Database['public']['Tables']['subscriptions']['Row'] & {
    plans: Database['public']['Tables']['plans']['Row'] | null;
};

// Basic TTL Cache for Plan Data
class PlanCache {
    private cache: Map<string, { data: Subscription | null, expiry: number }> = new Map();
    private TTL = 1000 * 60 * 5; // 5 minutes

    get(key: string) {
        const item = this.cache.get(key);
        if (!item) return undefined;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return undefined;
        }
        return item.data;
    }

    set(key: string, data: Subscription | null) {
        this.cache.set(key, { data, expiry: Date.now() + this.TTL });
    }
    
    ignore(key: string) {
        this.cache.delete(key);
    }
}

export const planCache = new PlanCache();

export async function getSubscription(warehouseId: string) {
  // Check memory cache first
  const cached = planCache.get(warehouseId);
  if (cached !== undefined) return cached;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('warehouse_id', warehouseId)
    .single();

  if (error && error.code !== 'PGRST116') {
    logError(error, { operation: 'getSubscription', metadata: { warehouseId } });
    return null;
  }
  
  const result = data as unknown as Subscription | null;
  
  // Update cache
  planCache.set(warehouseId, result);
  
  return result;
}

import { cache } from 'react';

export async function getSubscriptionWithUsage(warehouseId: string) {
  return _getSubscriptionWithUsageImpl(warehouseId);
}

// Internal implementation wrapped with cache for request-scoped deduplication
const _getSubscriptionWithUsageImpl = cache(async (warehouseId: string) => {
  const subscription = await getSubscription(warehouseId);
  
  // If no subscription, we might want to return usage only or null?
  // Previous logic seemed to want usage even if no sub (Free tier implicit).
  // But if subscription is null, spreading it spreads nothing.
  
  const supabase = await createClient();

  // Parallelize fetches for performance
  // Use RPC for optimized batch fetching
  const { data: stats, error } = await supabase.rpc('get_warehouse_usage_stats', { 
    p_warehouse_id: warehouseId, 
    p_month_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString() 
  });
  
  if (error) {
     logError(error, { operation: 'getSubscriptionWithUsage:RPC', metadata: { warehouseId } });
     // Fallback to manual if RPC fails (optional, or just return zeros)
  }

  const usage = {
        total_records: stats?.[0]?.total_records || 0,
        monthly_records: stats?.[0]?.monthly_records || 0,
        total_users: stats?.[0]?.total_users || 0
  };

  return {
    subscription,
    usage
  };
});

export async function checkSubscriptionLimits(warehouseId: string, action: 'add_record' | 'add_user'): Promise<{ allowed: boolean; message?: string }> {
    // We strictly need usage data for limits
    const { subscription, usage } = await getSubscriptionWithUsage(warehouseId);
    
    if (!subscription || !subscription.plans) {
        // Fallback for "Free Tier" or "No Plan"
        // This relies on the central feature-flags constants rather than a local magic number.
        const freeLimit = LIMITS.STORAGE_RECORDS!.limit.free;
        if ((usage.total_records || 0) >= freeLimit && action === 'add_record') {
             return { allowed: false, message: `Free Tier limit reached (${freeLimit} records). Please upgrade to add more.` };
        }
        return { allowed: true };
    }

    const { plans, status: rawStatus } = subscription;
    const status = rawStatus || SubscriptionStatus.ACTIVE;
    
    // Allow 'trialing' and 'active'
    if (status !== SubscriptionStatus.ACTIVE && status !== SubscriptionStatus.TRIALING) {
         return { allowed: false, message: `Subscription is ${status}. Please renew to continue.` };
    }

    // Auto-expire check
    if (subscription.current_period_end && new Date(subscription.current_period_end) < new Date()) {
         return { allowed: false, message: "Subscription period has ended. Please renew to continue." };
    }

    if (action === 'add_record') {
        const limit = plans.max_storage_records;
        // if limit is null, it means unlimited
        if (limit !== null && usage.total_records >= limit) {
             return { allowed: false, message: `Plan limit reached (${limit} records). Please upgrade.` };
        }
    }
    
    // Note: 'add_user' logic was explicitly removed as there is currently no `max_users` DB column
    // and staff accounts are typically managed by application logic, not hard subscription DB limits.

    return { allowed: true };
}

export async function checkFeatureAccess(warehouseId: string, feature: string): Promise<{ allowed: boolean; message?: string }> {
    // Usage not needed for feature check, so lightweight fetch is better.
    const subscription = await getSubscription(warehouseId);
    
    if (!subscription || !subscription.plans) {
        return { allowed: false, message: "Upgrade to access this feature." };
    }

    const { plans, status } = subscription;
    
    if (status !== SubscriptionStatus.ACTIVE && status !== SubscriptionStatus.TRIALING) {
         return { allowed: false, message: "Subscription inactive. Please renew." };
    }

    if (subscription.current_period_end && new Date(subscription.current_period_end) < new Date()) {
          return { allowed: false, message: "Subscription expired. Please renew." };
    }

    const features = plans.features as Record<string, boolean>;
    if (!features || !features[feature]) {
         return { allowed: false, message: `Your current plan (${plans.name}) does not support this feature.` };
    }

    return { allowed: true };
}

export async function checkWarehouseCreationLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
    const supabase = await createClient();
    
    // 1. Get current warehouse count
    const { count: warehouseCount, error: countError } = await supabase
        .from('warehouse_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('role', UserRole.OWNER); // Only count owned warehouses

    if (countError) {
         logError(countError, { operation: 'checkWarehouseCreationLimit' });
         return { allowed: false, message: 'Failed to verify plan limits' };
    }

    if ((warehouseCount || 0) === 0) {
        return { allowed: true };
    }

    // 2. Get User's Active Warehouse to check Plan
    const { data: profile } = await supabase
        .from('profiles')
        .select('warehouse_id')
        .eq('id', userId)
        .single();
    
    if (profile?.warehouse_id) {
        const subscription = await getSubscription(profile.warehouse_id);
        const maxWarehouses = subscription?.plans?.max_warehouses || 1; // Default to 1 (Free)
        
        if ((warehouseCount || 0) >= maxWarehouses) {
            return { 
                allowed: false,
                message: `Upgrade Required: Your current plan (${subscription?.plans?.name || 'Free'}) allows ${maxWarehouses} warehouse(s).`
            };
        }
    }
    
    return { allowed: true };
}
