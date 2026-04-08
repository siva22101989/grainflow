import { z } from 'zod';

/**
 * Input Validation Middleware
 * Provides reusable validation utilities for API routes and server actions
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: z.ZodError
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate FormData against a Zod schema
 */
export function validateFormData<T>(
  formData: FormData,
  schema: z.ZodSchema<T>
): T {
  const data: Record<string, any> = {};
  
  formData.forEach((value, key) => {
    // Handle multiple values for same key
    if (data[key]) {
      if (Array.isArray(data[key])) {
        data[key].push(value);
      } else {
        data[key] = [data[key], value];
      }
    } else {
      data[key] = value;
    }
  });

  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Form validation failed', error);
    }
    throw error;
  }
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (International format: 10-15 digits, optional +)
 * Matches DB constraint: ^\+?[0-9]{10,15}$
 */
export function isValidPhone(phone: string): boolean {
  // Remove spaces and dashes for validation
  const cleaned = phone.replace(/[\s-]/g, '');
  const phoneRegex = /^\+?[0-9]{10,15}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Format phone number by removing invalid characters
 */
export function formatPhoneNumber(phone: string): string {
  // Keep only digits and optional leading +
  return phone.replace(/[^0-9+]/g, '')
    .replace(/\+(?=.*\+)/g, ''); // Remove duplicate +
}

/**
 * Validate positive number
 */
export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && value > 0 && !isNaN(value);
}

/**
 * Validate date is not in future
 */
export function isNotFutureDate(date: Date): boolean {
  return date <= new Date();
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  uuid: z.string().uuid('Invalid ID format'),
  
  email: z.string().email('Invalid email address'),
  
  phone: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(16, 'Phone number too long') // +15 digits = 16 chars
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format (10-15 digits, optional +)')
    .transform(val => val.replace(/[\s-]/g, '')), // Auto-format: remove spaces/dashes
  
  positiveInt: z.number()
    .int('Must be a whole number')
    .positive('Must be greater than 0'),
  
  nonNegativeNumber: z.number()
    .nonnegative('Cannot be negative'),
  
  currency: z.number()
    .nonnegative('Amount cannot be negative')
    .multipleOf(0.01, 'Invalid currency amount'),
  
  date: z.date()
    .or(z.string().transform(str => new Date(str))),
  
  pastDate: z.date()
    .refine(date => date <= new Date(), 'Date cannot be in the future'),
};

