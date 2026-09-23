import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  parseISO,
  isValid,
  format,
  addDays,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

/**
 * Parse natural-language date expressions like "today", "yesterday", "last week".
 * Returns a Date in UTC corresponding to midnight in the given timezone.
 */
export function parseDateExpression(expression: string, timezone = 'Africa/Lagos'): Date {
  const expr = expression.toLowerCase().trim();
  const nowUtc = new Date();
  const nowInTz = toZonedTime(nowUtc, timezone);

  switch (expr) {
    case 'today':
      return fromZonedTime(startOfDay(nowInTz), timezone);

    case 'yesterday':
      return fromZonedTime(startOfDay(subDays(nowInTz, 1)), timezone);

    case 'tomorrow':
      return fromZonedTime(startOfDay(addDays(nowInTz, 1)), timezone);

    case 'last week':
      return fromZonedTime(startOfDay(subWeeks(nowInTz, 1)), timezone);

    case 'last month':
      return fromZonedTime(startOfDay(subMonths(nowInTz, 1)), timezone);

    default: {
      // Try parsing as ISO date
      const parsed = parseISO(expr);
      if (isValid(parsed)) return parsed;

      // "N days ago"
      const daysAgoMatch = expr.match(/^(\d+)\s+days?\s+ago$/);
      if (daysAgoMatch) {
        const n = parseInt(daysAgoMatch[1], 10);
        return fromZonedTime(startOfDay(subDays(nowInTz, n)), timezone);
      }

      // Default to today
      return fromZonedTime(startOfDay(nowInTz), timezone);
    }
  }
}

/**
 * Get a date range for common period expressions.
 */
export function getDateRange(period: string, timezone = 'Africa/Lagos'): DateRange {
  const nowUtc = new Date();
  const now = toZonedTime(nowUtc, timezone);

  switch (period.toLowerCase()) {
    case 'today':
      return {
        startDate: fromZonedTime(startOfDay(now), timezone),
        endDate: fromZonedTime(endOfDay(now), timezone),
        label: 'Today',
      };

    case 'yesterday':
      return {
        startDate: fromZonedTime(startOfDay(subDays(now, 1)), timezone),
        endDate: fromZonedTime(endOfDay(subDays(now, 1)), timezone),
        label: 'Yesterday',
      };

    case 'this_week':
    case 'this week':
      return {
        startDate: fromZonedTime(startOfWeek(now, { weekStartsOn: 1 }), timezone),
        endDate: fromZonedTime(endOfWeek(now, { weekStartsOn: 1 }), timezone),
        label: 'This Week',
      };

    case 'last_week':
    case 'last week': {
      const lastWeek = subWeeks(now, 1);
      return {
        startDate: fromZonedTime(startOfWeek(lastWeek, { weekStartsOn: 1 }), timezone),
        endDate: fromZonedTime(endOfWeek(lastWeek, { weekStartsOn: 1 }), timezone),
        label: 'Last Week',
      };
    }

    case 'this_month':
    case 'this month':
      return {
        startDate: fromZonedTime(startOfMonth(now), timezone),
        endDate: fromZonedTime(endOfMonth(now), timezone),
        label: format(now, 'MMMM yyyy'),
      };

    case 'last_month':
    case 'last month': {
      const lastMonth = subMonths(now, 1);
      return {
        startDate: fromZonedTime(startOfMonth(lastMonth), timezone),
        endDate: fromZonedTime(endOfMonth(lastMonth), timezone),
        label: format(lastMonth, 'MMMM yyyy'),
      };
    }

    case 'this_year':
    case 'this year':
      return {
        startDate: fromZonedTime(startOfYear(now), timezone),
        endDate: fromZonedTime(endOfYear(now), timezone),
        label: format(now, 'yyyy'),
      };

    default:
      // Default to current month
      return {
        startDate: fromZonedTime(startOfMonth(now), timezone),
        endDate: fromZonedTime(endOfMonth(now), timezone),
        label: format(now, 'MMMM yyyy'),
      };
  }
}

/**
 * Format a Date for display using a given timezone.
 */
export function formatDateInTz(date: Date, timezone: string, fmt = 'MMM d, yyyy'): string {
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, fmt);
}

/**
 * Get the current date/time in a given timezone.
 */
export function nowInTz(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}
