/**
 * AGMARKNET Service
 * 
 * Integrates with India's AGMARKNET API (via data.gov.in) to fetch
 * daily commodity prices from agricultural markets across India.
 * 
 * Data Source: https://data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070
 * Update Frequency: Daily (6:00 AM IST)
 * Coverage: 300+ commodities, 3000+ markets
 */

import { createClient } from '@/utils/supabase/server';
import { logError, logWarning } from './error-logger';

// AGMARKNET API Configuration
const AGMARKNET_API_BASE = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
const API_KEY = process.env.AGMARKNET_API_KEY || '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';

// Cache duration: 24 hours (prices update once daily)


export interface CommodityPrice {
  commodity: string;
  variety: string | null;
  market: string;
  state: string;
  district: string | null;
  min_price: number | null;
  max_price: number | null;
  modal_price: number | null;
  arrival_quantity: number | null;
  price_date: string; // YYYY-MM-DD format
}

interface AgmarknetAPIResponse {
  index_name: string;
  title: string;
  desc: string;
  org_type: string;
  org: string[];
  sector: string[];
  source: string;
  catalog_uuid: string;
  visualizable: string;
  target_bucket: {
    index_name: string;
    type: string;
    field: any[];
    message: string;
    total: number;
    records: AgmarknetRecord[];
  };
  message: string;
  version: string;
  status: string;
  total: number;
  count: number;
  limit: string;
  offset: string;
}

interface AgmarknetRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  arrival_date: string; // DD/MM/YYYY format
  min_price: string;
  max_price: string;
  modal_price: string;
  grade?: string;
}

/**
 * Fetch commodity prices from AGMARKNET API
 * 
 * @param commodity - Commodity name (e.g., "Wheat", "Rice")
 * @param state - Optional state filter (e.g., "Punjab", "Haryana")
 * @param limit - Number of records to fetch (default: 100)
 * @returns Array of commodity prices
 */
export async function fetchCommodityPrices(
  commodity: string,
  state?: string,
  limit: number = 100
): Promise<CommodityPrice[]> {
  try {
    // Build API URL with filters
    const params = new URLSearchParams({
      'api-key': API_KEY,
      'format': 'json',
      'limit': limit.toString(),
      'offset': '0',
    });

    // Add commodity filter
    params.append('filters[commodity]', commodity);

    // Add state filter if provided
    if (state) {
      params.append('filters[state]', state);
    }

    const url = `${AGMARKNET_API_BASE}?${params.toString()}`;

    // Fetching prices from AgMarkNet

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Cache for 1 hour to avoid hitting API rate limits
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[AGMARKNET] Rate limit exceeded (429). Switching to sample data.');
        return [];
      }
      logError(new Error(`[AGMARKNET] API error: ${response.status}`), { 
          operation: 'agmarknet_fetch', 
          metadata: { status: response.status, text: response.statusText, commodity } 
      });
      return [];
    }

    const data: AgmarknetAPIResponse = await response.json();

    if (data.status !== 'ok' || !data.target_bucket?.records) {
      logWarning('[AGMARKNET] Invalid response', { 
          operation: 'agmarknet_fetch', 
          metadata: { message: data.message, commodity } 
      });
      return [];
    }

    // Transform API response to our format
    const prices: CommodityPrice[] = data.target_bucket.records.map(record => ({
      commodity: record.commodity,
      variety: record.variety || null,
      market: record.market,
      state: record.state,
      district: record.district || null,
      min_price: parseFloat(record.min_price) || null,
      max_price: parseFloat(record.max_price) || null,
      modal_price: parseFloat(record.modal_price) || null,
      arrival_quantity: null, // Not provided in API response
      price_date: convertDateFormat(record.arrival_date),
    }));

    // Successfully fetched price records
    return prices;

  } catch (error) {
    logError(error, { operation: 'agmarknet_fetch_fatal', metadata: { commodity } });
    return [];
  }
}

/**
 * Get cached commodity prices from database
 * Falls back to API if cache is stale or missing
 * 
 * @param commodity - Commodity name
 * @param state - Optional state filter
 * @returns Array of commodity prices
 */
export async function getCachedPrices(
  commodity: string,
  state?: string
): Promise<CommodityPrice[]> {
  const supabase = await createClient();

  try {
    // Build query
    let query = supabase
      .from('commodity_prices')
      .select('*')
      .eq('commodity', commodity)
      .order('price_date', { ascending: false })
      .limit(90); // Last 90 days

    if (state) {
      query = query.eq('state', state);
    }

    const { data, error } = await query;

    if (error) {
      logError(error, { operation: 'getCachedPrices', metadata: { commodity, state } });
      // Return sample data instead of empty array
      return getSampleData(commodity);
    }

    // If we have any data, return it (don't require today's data)
    if (data && data.length > 0) {
      // Cache hit
      return data as CommodityPrice[];
    }

    // No cached data - try to fetch from API (with rate limit protection)
    // Cache miss - using sample data
    return getSampleData(commodity);

    /* API DISABLED PER USER REQUEST
    // Cache miss - fetching from API
    
    // Check if we've made too many requests recently
    const canFetchFromAPI = await checkRateLimit();
    
    if (!canFetchFromAPI) {
      console.warn('[AGMARKNET] Rate limit protection - using sample data');
      return getSampleData(commodity);
    }

    const freshPrices = await fetchCommodityPrices(commodity, state, 50);

    // If API fetch failed, return sample data
    if (freshPrices.length === 0) {
      console.warn('[AGMARKNET] API fetch failed - using sample data');
      return getSampleData(commodity);
    }

    // Store in database for future use
    await storePrices(freshPrices);

    return freshPrices;
    */

  } catch (error) {
    logError(error, { operation: 'getCachedPrices_fatal', metadata: { commodity, state } });
    return getSampleData(commodity);
  }
}

/**
 * Check if we can make an API request (rate limit protection)
 * Allows max 5 requests per minute
 */




/**
 * Get sample data for development/testing
 * Returns realistic price data for common commodities
 */
function getSampleData(commodity: string): CommodityPrice[] {
  const today = new Date();
  const data: CommodityPrice[] = [];

  // Sample prices for common commodities
  const basePrices: Record<string, number> = {
    'Wheat': 2400,
    'Rice': 3200,
    'Paddy': 2100,
    'Maize': 1800,
    'Bajra': 2000,
    'Jowar': 2200,
    'Gram': 4500,
    'Tur': 6000,
    'Moong': 7000,
    'Urad': 6500,
  };

  const basePrice = basePrices[commodity] || 2500;

  // Generate 30 days of sample data
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Add some realistic variation
    const variation = (Math.random() - 0.5) * 200; // ±100
    const price = Math.round(basePrice + variation);

    data.push({
      commodity,
      variety: 'Sample Variety',
      market: 'Sample Market',
      state: 'Punjab',
      district: 'Ludhiana',
      min_price: price - 50,
      max_price: price + 50,
      modal_price: price,
      arrival_quantity: Math.round(1000 + Math.random() * 500),
      price_date: date.toISOString().split('T')[0] ?? '',
    });
  }

  // Using sample data
  return data;
}

/**
 * Store commodity prices in database
 * Uses upsert to avoid duplicates
 * 
 * @param prices - Array of commodity prices to store
 */
export async function storePrices(prices: CommodityPrice[]): Promise<void> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from('commodity_prices')
      .upsert(prices, {
        onConflict: 'commodity,market,price_date',
        ignoreDuplicates: false
      });

    if (error) {
      logError(error, { operation: 'storePrices' });
    } else {
      // Stored price records in cache
    }
  } catch (error) {
    logError(error, { operation: 'storePrices_fatal' });
  }
}

/**
 * Get price trend for a commodity
 * 
 * @param commodity - Commodity name
 * @param state - Optional state filter
 * @param days - Number of days to analyze (default: 30)
 * @returns Price trend data
 */
export async function getPriceTrend(
  commodity: string,
  state?: string,
  _days: number = 30
): Promise<{
  current: number | null;
  average: number | null;
  min: number | null;
  max: number | null;
  trend: 'rising' | 'falling' | 'stable';
  change_percent: number | null;
  history: Array<{ date: string; price: number }>;
}> {
  const prices = await getCachedPrices(commodity, state);

  if (prices.length === 0) {
    return {
      current: null,
      average: null,
      min: null,
      max: null,
      trend: 'stable',
      change_percent: null,
      history: [],
    };
  }

  // Calculate statistics
  const modalPrices = prices
    .filter(p => p.modal_price !== null)
    .map(p => p.modal_price as number);

  const current = modalPrices[0] || null;
  const average = modalPrices.length > 0
    ? modalPrices.reduce((sum, price) => sum + price, 0) / modalPrices.length
    : null;
  const min = modalPrices.length > 0 ? Math.min(...modalPrices) : null;
  const max = modalPrices.length > 0 ? Math.max(...modalPrices) : null;

  // Calculate trend (simple linear regression)
  const trend = calculateTrend(prices.slice(0, 7)); // Last 7 days

  // Calculate change percentage
  const oldPrice = modalPrices[modalPrices.length - 1] || null;
  const change_percent = current && oldPrice
    ? ((current - oldPrice) / oldPrice) * 100
    : null;

  // Build history
  const history = prices
    .filter(p => p.modal_price !== null)
    .map(p => ({
      date: p.price_date,
      price: p.modal_price as number,
    }));

  return {
    current,
    average,
    min,
    max,
    trend,
    change_percent,
    history,
  };
}

/**
 * Calculate price trend using simple linear regression
 * 
 * @param prices - Array of recent prices
 * @returns Trend direction
 */
function calculateTrend(prices: CommodityPrice[]): 'rising' | 'falling' | 'stable' {
  if (prices.length < 3) return 'stable';

  const modalPrices = prices
    .filter(p => p.modal_price !== null)
    .map(p => p.modal_price as number);

  if (modalPrices.length < 3) return 'stable';

  // Simple slope calculation
  const firstPrice = modalPrices[modalPrices.length - 1]!;
  const lastPrice = modalPrices[0]!;
  const slope = (lastPrice - firstPrice) / modalPrices.length;

  // Threshold: 1% change per day
  const threshold = firstPrice * 0.01;

  if (slope > threshold) return 'rising';
  if (slope < -threshold) return 'falling';
  return 'stable';
}

/**
 * Convert DD/MM/YYYY to YYYY-MM-DD format
 * 
 * @param dateStr - Date string in DD/MM/YYYY format
 * @returns Date string in YYYY-MM-DD format
 */
function convertDateFormat(dateStr: string): string {
  try {
    const [day, month, year] = dateStr.split('/');
    if (!day || !month || !year) throw new Error('Invalid date format');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } catch (error) {
    logError(error, { operation: 'convertDateFormat', metadata: { dateStr } });
    return new Date().toISOString().split('T')[0] ?? ''; // Fallback to today
  }
}

/**
 * Get list of all available commodities from database
 * 
 * @returns Array of unique commodity names
 */
export async function getAvailableCommodities(): Promise<string[]> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from('commodity_prices')
      .select('commodity')
      .order('commodity');

    if (error) {
      logError(error, { operation: 'getAvailableCommodities' });
      return [];
    }

    // Get unique commodities
    const uniqueCommodities = [...new Set(data?.map(r => r.commodity) || [])];
    return uniqueCommodities;

  } catch (error) {
    logError(error, { operation: 'getAvailableCommodities_fatal' });
    return [];
  }
}

/**
 * Get list of markets for a specific commodity
 * 
 * @param commodity - Commodity name
 * @param state - Optional state filter
 * @returns Array of market names
 */
export async function getMarketsForCommodity(
  commodity: string,
  state?: string
): Promise<Array<{ market: string; state: string; district: string | null }>> {
  const supabase = await createClient();

  try {
    let query = supabase
      .from('commodity_prices')
      .select('market, state, district')
      .eq('commodity', commodity)
      .order('market');

    if (state) {
      query = query.eq('state', state);
    }

    const { data, error } = await query;

    if (error) {
      logError(error, { operation: 'getMarketsForCommodity', metadata: { commodity, state } });
      return [];
    }

    // Get unique markets
    const uniqueMarkets = data?.reduce((acc, curr) => {
      const key = `${curr.market}-${curr.state}`;
      if (!acc.some(m => `${m.market}-${m.state}` === key)) {
        acc.push(curr);
      }
      return acc;
    }, [] as Array<{ market: string; state: string; district: string | null }>);

    return uniqueMarkets || [];

  } catch (error) {
    logError(error, { operation: 'getMarketsForCommodity_fatal', metadata: { commodity, state } });
    return [];
  }
}
