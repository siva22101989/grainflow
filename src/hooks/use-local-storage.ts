'use client';

import { useState, useEffect, useCallback } from 'react';
import { logWarning } from '@/lib/error-logger';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Hydration-safe: Only access window/localStorage inside useEffect which runs on client
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      logWarning(`Error reading localStorage key "${key}"`, {
        operation: 'useLocalStorage.read',
        metadata: { key },
      });
    }
  }, [key]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((currentValue) => {
        const valueToStore = value instanceof Function ? value(currentValue) : value;
        
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
        
        return valueToStore;
      });
    } catch (error) {
      logWarning(`Error setting localStorage key "${key}"`, {
        operation: 'useLocalStorage.write',
        metadata: { key },
      });
    }
  }, [key]);

  return [storedValue, setValue] as const;
}
