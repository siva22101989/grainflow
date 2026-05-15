import React from 'react';
import { useUnifiedToast } from '@/components/shared/toast-provider';
import { useSubscription } from '@/components/providers/subscription-context';

export type PlanTier =
  | 'free'
  | 'starter' | 'starter_monthly' | 'starter_yearly'
  | 'professional' | 'professional_monthly' | 'professional_yearly'
  | 'enterprise' | 'enterprise_monthly' | 'enterprise_yearly'
  | 'test_1rupee'; // Smoke-test plan for verifying live Razorpay end-to-end. Remove after launch.

export interface FeatureGate {
  id: string;
  name: string;
  tier: PlanTier;
}

export interface UsageLimit {
    id: string; // e.g., 'storage_records'
    name: string;
    limit: Record<PlanTier, number>;
}

export const FEATURES: Record<string, FeatureGate> = {
  REPORTS_EXPORT: { id: 'reports_export', name: 'Advanced Reports Export', tier: 'starter' },
  ANALYTICS_DASHBOARD: { id: 'analytics_dashboard', name: 'Analytics Dashboard', tier: 'professional' },
  MULTI_WAREHOUSE: { id: 'multi_warehouse', name: 'Multiple Warehouses', tier: 'professional' },
  WHATSAPP_NOTIFICATIONS: { id: 'whatsapp_notifications', name: 'WhatsApp Notifications', tier: 'starter' },
  API_ACCESS: { id: 'api_access', name: 'API Access', tier: 'enterprise' },
};

export const LIMITS: Record<string, UsageLimit> = {
    STORAGE_RECORDS: {
        id: 'storage_records',
        name: 'Storage Records',
        limit: {
            free: 100,
            starter: 10000,
            starter_monthly: 10000,
            starter_yearly: 10000,
            professional: 100000,
            professional_monthly: 100000,
            professional_yearly: 100000,
            enterprise: 1000000,
            enterprise_monthly: 1000000,
            enterprise_yearly: 1000000,
            test_1rupee: 100, // smoke-test plan: free-tier limits
        }
    },
    USERS: {
        id: 'users',
        name: 'Team Members',
        limit: {
            free: 1,
            starter: 3,
            starter_monthly: 3,
            starter_yearly: 3,
            professional: 10,
            professional_monthly: 10,
            professional_yearly: 10,
            enterprise: 50,
            enterprise_monthly: 50,
            enterprise_yearly: 50,
            test_1rupee: 1, // smoke-test plan: free-tier limits
        }
    }
};

/**
 * Hook to check if a feature is enabled or limit is reached.
 */
export function useFeatureGate() {
  const { warn } = useUnifiedToast();
  const { subscription, loading } = useSubscription();
  const [currentUsage, setCurrentUsage] = React.useState<Record<string, number>>({});

  // Mock usage fetch - replace with real API call
  React.useEffect(() => {
      // simulate usage
      setCurrentUsage({
          storage_records: 45,
          users: 1
      });
  }, []);

  const checkFeature = (featureGate: FeatureGate): boolean => {
    if (loading || !subscription) return false;
    
    // 1. Dynamic DB Check (Preferred)
    // We expect 'features' to be a JSON object in the plan
    const dbFeatures = subscription.plan.features as Record<string, boolean> | undefined;
    if (dbFeatures && typeof dbFeatures[featureGate.id] !== 'undefined') {
        return dbFeatures[featureGate.id] === true && ['active', 'trailing_trial'].includes(subscription.status);
    }

    // 2. Legacy Tier Priority Check (Fallback)
    const currentPlan = subscription.plan.tier;
    const tierPriority: Record<string, number> = {
      free: 0,
      starter: 1,
      starter_monthly: 1,
      starter_yearly: 1,
      professional: 2,
      professional_monthly: 2,
      professional_yearly: 2,
      enterprise: 3,
      enterprise_monthly: 3,
      enterprise_yearly: 3,
      test_1rupee: 0, // smoke-test plan unlocks nothing
    };

    const currentPriority = tierPriority[currentPlan] ?? 0;
    const requiredPriority = tierPriority[featureGate.tier] ?? 0;

    if (currentPriority >= requiredPriority) {
      return ['active', 'trailing_trial'].includes(subscription.status);
    }

    return false;
  };

  const checkLimit = (limitId: string, additionalAmount = 0): boolean => {
      if (loading || !subscription) return false;
      
      const usage = currentUsage[limitId] || 0;
      let maxLimit = 0;

      // 1. Dynamic DB Limits (Preferred)
      // Check known limits mapped to DB columns
      if (limitId === 'storage_records' && typeof subscription.plan.max_storage_records === 'number') {
          maxLimit = subscription.plan.max_storage_records;
      } else if (limitId === 'users' && typeof subscription.plan.max_users === 'number') {
          maxLimit = subscription.plan.max_users;
      } else {
          // 2. Fallback to Hardcoded Limits
          const limitConfig = Object.values(LIMITS).find(l => l.id === limitId);
          if (!limitConfig) return true; // Limit not defined, allow
          
          const currentPlan = subscription.plan.tier;
          maxLimit = (limitConfig.limit as any)[currentPlan] || 0;
      }

      return (usage + additionalAmount) <= maxLimit;
  };

  const handleRestrictedAction = (featureGate: FeatureGate) => {
    warn(
      'Upgrade Required',
      `The "${featureGate.name}" feature is available on the ${featureGate.tier} plan and above.`
    );
  };

  const handleLimitReached = (limitConfig: UsageLimit) => {
      warn(
        'Limit Reached',
        `You have reached the ${limitConfig.name} limit for your current plan. Please upgrade to add more.`
      );
  };

  return { checkFeature, checkLimit, handleRestrictedAction, handleLimitReached, isLoading: loading };
}
