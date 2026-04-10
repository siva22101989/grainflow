'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUserWarehouses, getActiveWarehouseId } from '@/lib/warehouse-actions';
import { useLocalStorage } from "@/hooks/use-local-storage";
import { createClient } from '@/utils/supabase/client';
import type { WarehouseWithRole } from '@/lib/definitions';

type WarehouseCache = {
  data: WarehouseWithRole[];
  timestamp: number;
  activeId: string | null;
};

type WarehouseContextType = {
  warehouses: WarehouseWithRole[];
  currentWarehouse: WarehouseWithRole | undefined;
  setCurrentWarehouse: (warehouse: WarehouseWithRole | undefined) => void;
  refreshWarehouses: () => Promise<void>;
  isLoading: boolean;
};

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

const CACHE_KEY = 'grainflow_warehouses';
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes

export function WarehouseProvider({ children }: { children: React.ReactNode }) {
  const [warehouseCache, setWarehouseCache] = useLocalStorage<WarehouseCache | null>(CACHE_KEY, null);
  
  const [warehouses, setWarehouses] = useState<WarehouseWithRole[]>([]);
  const [currentWarehouse, setCurrentWarehouse] = useState<WarehouseWithRole | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const refreshWarehouses = async () => {
    try {
      const [list, activeId] = await Promise.all([
        getUserWarehouses(),
        getActiveWarehouseId()
      ]);
      
      setWarehouses(list);
      
      if (activeId) {
        const match = list.find((w) => w.id === activeId);
        setCurrentWarehouse(match);
      }

      // Cache
      setWarehouseCache({
        data: list,
        timestamp: Date.now(),
        activeId
      });
    } catch (err) {
      console.error('Warehouse fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Initial Load from Cache
  useEffect(() => {
    const init = async () => {
      // Check if user is logged in before loading warehouses
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Try to load from cache first
      if (warehouseCache) {
        try {
          const { data, timestamp, activeId } = warehouseCache;
          const age = Date.now() - timestamp;
          
          if (age < CACHE_DURATION) {
            setWarehouses(data);
            if (activeId) {
              const match = data.find((w) => w.id === activeId);
              setCurrentWarehouse(match);
            }
            setIsLoading(false);
            
            // If cache is more than half expired, refresh in foreground
            // so the user gets fresh data before interacting
            if (age > CACHE_DURATION * 0.5) {
              await refreshWarehouses();
            }
            return;
          }
        } catch (e) {
          console.error('Cache read error:', e);
        }
      }

      await refreshWarehouses();
    };

    init();
  }, []);

  // 2. Auth Listener
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
             refreshWarehouses().catch(() => {});
        } else if (event === 'SIGNED_OUT') {
             setWarehouses([]);
             setCurrentWarehouse(undefined);
             setWarehouseCache(null);
        }
    });

    return () => {
        subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Optimistic Switching
  const setCurrentWarehouseCallback = (warehouse: WarehouseWithRole | undefined) => {
    // 1. Optimistic Update (Immediate UI change)
    setCurrentWarehouse(warehouse);
    
    // 2. Persist to Cache
    setWarehouseCache({
      data: warehouses,
      timestamp: Date.now(),
      activeId: warehouse?.id || null
    });
    
    // 3. Trigger Server Update (Background)
    if (warehouse?.id) {
       // Note: We don't await this to keep UI responsive. 
       // The server action 'switchWarehouse' should be called by the UI component invoking this.
       // This context mainly manages CLIENT state.
    }
  };

  return (
    <WarehouseContext.Provider value={{ 
      warehouses, 
      currentWarehouse, 
      setCurrentWarehouse: setCurrentWarehouseCallback,
      refreshWarehouses,
      isLoading 
    }}>
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouses() {
  const context = useContext(WarehouseContext);
  if (!context) {
    throw new Error('useWarehouses must be used within WarehouseProvider');
  }
  return context;
}
