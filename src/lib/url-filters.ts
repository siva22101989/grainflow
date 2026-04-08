import { DateRange } from 'react-day-picker';

/**
 * Generic filter state interface
 */
export interface FilterState {
  [key: string]: any;
}

/**
 * Serialize filter state to URL search parameters
 */
/**
 * Converts a filter state object to URL search parameters
 * Skips values that match defaults to keep URL clean
 */
export function filtersToSearchParams<T extends FilterState>(
  filters: T,
  defaults?: T
): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    // Skip if value is null/undefined/empty string
    if (value === null || value === undefined || value === '') {
      return; 
    }

    const filterKey = key as keyof T;

    // Skip if it matches the default value
    if (defaults && JSON.stringify(value) === JSON.stringify(defaults[filterKey])) {
      return;
    }

    // Handle arrays (comma-separated)
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(','));
      }
      return;
    }

    // Handle dates (ISO string)
    if (value instanceof Date) {
      params.set(key, value.toISOString().split('T')[0]!); // YYYY-MM-DD format
      return;
    }

    // Handle DateRange object
    if (typeof value === 'object' && 'from' in value) {
      const dateRange = value as DateRange;
      if (dateRange.from) {
        params.set('dateFrom', dateRange.from.toISOString().split('T')[0]!);
      }
      if (dateRange.to) {
        params.set('dateTo', dateRange.to.toISOString().split('T')[0]!);
      }
      return;
    }

    // Handle boolean
    if (typeof value === 'boolean') {
      params.set(key, value ? '1' : '0');
      return;
    }

    // Handle numbers and strings
    params.set(key, String(value));
  });

  return params;
}

/**
 * Parse URL search parameters to filter state
 */
export function searchParamsToFilters<T extends FilterState>(
  params: URLSearchParams,
  defaults: T
): T {
  // We need to construct this object carefully.
  // Instead of casting to any, we can explicitly type the accumulatd object or cast just at the end.
  const filters: T = { ...defaults };

  params.forEach((value, key) => {
    // If it's a dateFrom/dateTo, we'll handle it specially later if dateRange is in defaults
    if (key === 'dateFrom' || key === 'dateTo') return;

    // Skip if key not in defaults
    if (!(key in defaults)) {
      return;
    }

    const filterKey = key as keyof T;
    const defaultValue = defaults[filterKey];

    // Handle arrays
    if (Array.isArray(defaultValue)) {
      (filters[filterKey] as any) = value.split(',').filter(Boolean);
      return;
    }

    // Handle dates
    if ((defaultValue as any) instanceof Date || (typeof defaultValue === 'string' && !isNaN(Date.parse(value)) && (key.includes('date') || key.includes('Date')))) {
      const date = new Date(value);
      (filters[filterKey] as any) = isNaN(date.getTime()) ? defaultValue : date;
      return;
    }

    // Handle numbers
    if (typeof defaultValue === 'number' || (defaultValue === null && (key.includes('min') || key.includes('max') || key === 'page'))) {
      const num = Number(value);
      (filters[filterKey] as any) = isNaN(num) ? defaultValue : num;
      return;
    }

    // Handle boolean
    if (typeof defaultValue === 'boolean') {
      (filters[filterKey] as any) = value === '1' || value === 'true';
      return;
    }

    // Handle string
    (filters[filterKey] as any) = value;
  });

  // Reconstruct DateRange if it's expected in defaults
  if ('dateRange' in defaults) {
    const from = params.get('dateFrom');
    const to = params.get('dateTo');
    
    if (from || to) {
      (filters as any).dateRange = {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      };
    } else {
      (filters as any).dateRange = (defaults as any).dateRange;
    }
  }

  return filters;
}

/**
 * Get shareable URL with current filters
 */
export function getShareableFilterUrl(filters: FilterState): string {
  const params = filtersToSearchParams(filters);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Get human-readable filter summary
 */
export function getAppliedFiltersSummary(filters: FilterState): { label: string; value: string }[] {
  const summary: { label: string; value: string }[] = [];

  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '' || value === false) {
      return;
    }

    // Skip default values
    if (key === 'status' && value === 'active') return;
    if (key === 'page' && value === 1) return;
    if (key === 'sortBy') return; // Don't show sort in summary

    // Format label
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace('Selected ', '')
      .replace('min ', 'Min ')
      .replace('max ', 'Max ');

    // Format value
    let displayValue: string;

    if (Array.isArray(value)) {
      displayValue = value.join(', ');
    } else if (value instanceof Date) {
      displayValue = value.toLocaleDateString();
    } else if (typeof value === 'object' && 'from' in value) {
      const dateRange = value as DateRange;
      const from = dateRange.from?.toLocaleDateString() || 'Any';
      const to = dateRange.to?.toLocaleDateString() || 'Any';
      displayValue = `${from} - ${to}`;
    } else {
      displayValue = String(value);
    }

    summary.push({ label, value: displayValue });
  });

  return summary;
}

