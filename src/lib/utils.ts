
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
  }).format(amount);
}

export function toDate(date: Date | string): Date {
    if (date instanceof Date) {
        return date;
    }
    return new Date(date);
}

/** Canonical date display format for the whole app: "23 Dec 2024". */
export const DATE_FORMAT = 'dd MMM yyyy';

/**
 * The single way to render a date for a user to read.
 *
 * Use this instead of `toLocaleDateString()`, which renders differently
 * depending on the viewer's locale — the same statement showed "12/23/2024"
 * to one user and "23/12/2024" to another. Returns '' for null/invalid input
 * so callers can drop it straight into a cell without guarding.
 */
export function formatDate(value: Date | string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? '' : format(d, DATE_FORMAT);
}
