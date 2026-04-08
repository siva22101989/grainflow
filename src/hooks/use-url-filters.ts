import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDebounce } from '@uidotdev/usehooks';
import { filtersToSearchParams, searchParamsToFilters, type FilterState } from '@/lib/url-filters';

export interface UseUrlFiltersOptions {
  /**
   * Debounce delay in milliseconds before updating URL
   * @default 300
   */
  debounce?: number;
  
  /**
   * Whether to use replace or push for navigation
   * @default true (replace - no history pollution)
   */
  replace?: boolean;
  
  /**
   * Whether to scroll to top on filter change
   * @default false
   */
  scroll?: boolean;
}

/**
 * Custom hook for managing filter state synchronized with URL parameters
 */
export function useUrlFilters<T extends FilterState>(
  defaults: T,
  options: UseUrlFiltersOptions = {}
) {
  const { debounce = 300, replace = true, scroll = false } = options;
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // Stabilize defaults
  const defaultsRef = useRef(defaults);
  useEffect(() => {
    // Only update if fundamentally different (rare in this app)
    if (JSON.stringify(defaults) !== JSON.stringify(defaultsRef.current)) {
      defaultsRef.current = defaults;
    }
  }, [defaults]);

  // Support for external search params (optional)
  // Initialize from URL on mount
  const [filters, setFilters] = useState<T>(() => {
    return searchParamsToFilters(searchParams, defaultsRef.current);
  });
  
  // Track if this is initial mount
  const isInitialMount = useRef(true);
  
  // Track what we're waiting for from the router to avoid synchronization race conditions
  const pendingPushUrl = useRef<string | null>(null);

  // Debounced filters for URL updates
  const debouncedFilters = useDebounce(filters, debounce);

  // Sync URL when debounced filters change
  useEffect(() => {
    // Skip URL update on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Pass defaults to skip matching values in URL (keeping it clean)
    const params = filtersToSearchParams(debouncedFilters, defaultsRef.current);
    // Sort keys for consistent URL comparison
    params.sort();
    const queryString = params.toString();
    const newUrl = `${pathname}${queryString ? '?' + queryString : ''}`;
    
    // Get current URL and sort its params for a fair comparison
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.sort();
    const currentUrl = `${pathname}${currentParams.toString() ? '?' + currentParams.toString() : ''}`;

    // Only navigate if the URL is fundamentally different from what's already there
    // and we aren't already waiting for this exact URL
    if (newUrl !== currentUrl && newUrl !== pendingPushUrl.current) {
      pendingPushUrl.current = newUrl;
      const navOptions = { scroll };
      if (replace) {
        router.replace(newUrl, navOptions);
      } else {
        router.push(newUrl, navOptions);
      }
    }
  }, [debouncedFilters, pathname, router, replace, scroll]); // Removed searchParams to prevent overwriting external changes
  
  // Update filters when URL changes externally (browser back/forward)
  useEffect(() => {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.sort();
    const currentUrl = `${pathname}${currentParams.toString() ? '?' + currentParams.toString() : ''}`;
    
    // CASE 1: The URL has reached our desired state after a push
    if (pendingPushUrl.current !== null && currentUrl === pendingPushUrl.current) {
      pendingPushUrl.current = null;
      return;
    }

    // CASE 2: We are currently waiting for a navigation to complete
    // We ignore ALL intermediate URL changes to prevent "flickering" back to old state
    if (pendingPushUrl.current !== null) {
      return;
    }

    // CASE 3: Standard external change (back/forward button)
    const newFilters = searchParamsToFilters(searchParams, defaultsRef.current);
    const isStateDifferent = JSON.stringify(newFilters) !== JSON.stringify(filters);
    
    if (isStateDifferent) {
      setFilters(newFilters);
    }
  }, [searchParams, pathname]); 
  
  return [filters, setFilters] as const;
}

