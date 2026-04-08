/**
 * Utility types for improved type safety across the application
 *
 * These types help enforce stricter type checking and provide
 * better developer experience with TypeScript.
 */

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Successful API response
 */
export type ApiSuccess<T> = {
  success: true;
  data: T;
};

/**
 * Failed API response
 */
export type ApiError = {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
};

/**
 * Generic API response type
 */
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if API response is successful
 */
export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccess<T> {
  return response.success === true;
}

/**
 * Check if API response is an error
 */
export function isApiError<T>(
  response: ApiResponse<T>
): response is ApiError {
  return response.success === false;
}
