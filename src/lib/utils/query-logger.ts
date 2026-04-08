/**
 * Query logging utilities for debugging and performance monitoring
 */

export interface QueryLog {
  queryName: string;
  operation: string;
  warehouseId?: string;
  duration?: number;
  timestamp: Date;
  params?: Record<string, any>;
  error?: any;
  rowCount?: number;
}

/**
 * Query logger configuration
 */
interface QueryLoggerConfig {
  enabled: boolean;
  logSlowQueries: boolean;
  slowQueryThreshold: number; // milliseconds
  logToConsole: boolean;
  logToFile: boolean;
  includeParams: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: QueryLoggerConfig = {
  enabled: process.env.NODE_ENV === 'development',
  logSlowQueries: true,
  slowQueryThreshold: 1000, // 1 second
  logToConsole: true,
  logToFile: false,
  includeParams: process.env.NODE_ENV === 'development',
};

let config = { ...DEFAULT_CONFIG };

/**
 * Log a query
 */
function logQuery(log: QueryLog) {
  if (!config.enabled) return;

  // Only log slow queries if configured
  if (config.logSlowQueries && log.duration) {
    if (log.duration < config.slowQueryThreshold) {
      return;
    }
  }


  if (config.logToConsole) {
    const emoji = log.error ? '❌' : log.duration && log.duration > config.slowQueryThreshold ? '🐌' : '✅';
    const durationStr = log.duration ? `${log.duration}ms` : '';
    const rowCountStr = log.rowCount !== undefined ? `(${log.rowCount} rows)` : '';
    
    console.log(
      `${emoji} [QUERY] ${log.queryName} ${durationStr} ${rowCountStr}`,
      config.includeParams && log.params ? log.params : ''
    );

    if (log.error) {
      console.error('Query Error:', log.error);
    }
  }

  // Could add file logging here if needed
  if (config.logToFile) {
    // TODO: Implement file logging
  }
}

/**
 * Measure query execution time
 */
export async function measureQuery<T>(
  queryName: string,
  operation: string,
  queryFn: () => Promise<T>,
  params?: Record<string, any>
): Promise<T> {
  const startTime = Date.now();
  const log: QueryLog = {
    queryName,
    operation,
    timestamp: new Date(),
    params,
  };

  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    log.duration = duration;
    
    // Try to get row count if result is an array
    if (Array.isArray(result)) {
      log.rowCount = result.length;
    }

    logQuery(log);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.duration = duration;
    log.error = error;
    logQuery(log);
    throw error;
  }
}

