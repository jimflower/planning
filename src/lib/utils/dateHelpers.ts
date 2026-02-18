import { format, parseISO } from 'date-fns';
import type { Season } from '@/types/planning.types';

/** Return today in YYYY-MM-DD */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Pretty-print an ISO date string */
export function formatDate(iso: string, pattern = 'dd-MM-yyyy'): string {
  return format(parseISO(iso), pattern);
}

/** Determine which season a date falls in */
export function getSeason(iso: string): Season {
  const month = parseISO(iso).getMonth(); // 0-based
  if (month >= 11 || month <= 1) return 'Dec-Feb';
  if (month >= 2 && month <= 4) return 'Mar-May';
  if (month >= 5 && month <= 7) return 'Jun-Aug';
  return 'Sep-Nov';
}

/** Generate a UUID (browser-native) */
export function uuid(): string {
  return crypto.randomUUID();
}
