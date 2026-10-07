'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { PlanTier } from '@/lib/feature-flags';
import { getSubscriptionAction } from '@/lib/subscription-actions';
import { logError } from '@/lib/error-logger';

interface Subscription {
  plan: {
    name: string;
    display_name: string;
    tier: PlanTier;
    features: any;
    max_storage_records?: number;
    max_users?: number;
    max_warehouses?: number;
  };
  status: string;
  warehouse_id: string;
  current_period_end?: string | Date | null;
  trial_start_date?: string | Date | null;
  trial_end_date?: string | Date | null;
  usage: {
    total_records: number;
    monthly_records: number;
    total_users: number;
  };
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ 
  children, 
  warehouseId 
}: { 
  children: React.ReactNode;
  warehouseId: string;
}) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSubscription = async () => {
    if (!warehouseId) {
        setLoading(false);
        return;
    }
    
    try {
      const data = await getSubscriptionAction(warehouseId);
      if (data) {
        // Safe fallback if joined plan data is missing
        const planData = data.plans || { 
            name: 'free', 
            display_name: 'Free', 
            tier: 'free', 
            features: {} 
        };

        setSubscription({
          plan: planData,
          status: data.status || 'inactive',
          warehouse_id: data.warehouse_id,
          current_period_end: data.current_period_end,
          trial_start_date: data.trial_start_date,
          trial_end_date: data.trial_end_date,
          usage: data.usage || { total_records: 0, monthly_records: 0, total_users: 0 }
        });
      } else {
        // Fallback to free if no subscription found
        setSubscription({
          plan: { tier: 'free', features: {}, name: 'free', display_name: 'Free' },
          status: 'active',
          warehouse_id: warehouseId,
          usage: { total_records: 0, monthly_records: 0, total_users: 0 }
        });
      }
    } catch (err) {
      logError(err, { operation: 'subscriptionContext.fetch' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSubscription();
  }, [warehouseId]);

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, refreshSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
