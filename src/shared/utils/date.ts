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

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function parseMonthPart(str: string): { month: number; year?: number } | null {
  const m = str.trim().toLowerCase().match(/^([a-z]+)(?:\s+(\d{4}))?$/);
  if (!m) return null;
  const monthName = m[1];
  if (!(monthName in MONTH_MAP)) return null;
  return {
    month: MONTH_MAP[monthName],
    year: m[2] ? parseInt(m[2], 10) : undefined,
  };
}

function parseDayMonthPart(str: string): { day: number; month: number; year?: number } | null {
  const s = str.trim().toLowerCase();
  // Format: 12th jan 2026 or 12th jan or 5 march
  const m1 = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/);
  if (m1 && m1[2] in MONTH_MAP) {
    return {
      day: parseInt(m1[1], 10),
      month: MONTH_MAP[m1[2]],
      year: m1[3] ? parseInt(m1[3], 10) : undefined,
    };
  }
  // Format: jan 12th 2026 or jan 12 or march 5th
  const m2 = s.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/);
  if (m2 && m2[1] in MONTH_MAP) {
    return {
      day: parseInt(m2[2], 10),
      month: MONTH_MAP[m2[1]],
      year: m2[3] ? parseInt(m2[3], 10) : undefined,
    };
  }
  // Format: 2026-01-12
  const m3 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m3) {
    return {
      year: parseInt(m3[1], 10),
      month: parseInt(m3[2], 10) - 1,
      day: parseInt(m3[3], 10),
    };
  }
  // Format: 12/01/2026 or 12/01
  const m4 = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (m4) {
    let year: number | undefined = undefined;
    if (m4[3]) {
      year = parseInt(m4[3], 10);
      if (year < 100) year += 2000;
    }
    return {
      day: parseInt(m4[1], 10),
      month: parseInt(m4[2], 10) - 1,
      year,
    };
  }
  return null;
}

/**
 * Parse custom date range expressions such as:
 * - "Jan - March", "Jan - Dec", "Jan to March"
 * - "12th jan - 5th March", "12 Jan - 5 Mar", "Jan 12 to Mar 5"
 * - "January", "March 2025"
 * - "2025", "2026"
 * - "Q1", "Q2 2026"
 * - "last 30 days", "last 3 months"
 */
function parseCustomDateRange(rawPeriod: string, timezone: string): DateRange | null {
  let period = rawPeriod.trim().toLowerCase();
  // Strip leading words like export, report, records, etc.
  period = period.replace(/^(?:export|report|records|csv|pdf|summary|expenses|income|for|from|between|show|get|download)\s+/i, '');
  period = period.replace(/\s+(?:csv|pdf|report|records|expenses|income)$/i, '').trim();

  if (!period) return null;

  const nowUtc = new Date();
  const now = toZonedTime(nowUtc, timezone);
  const curYear = now.getFullYear();

  const pad = (n: number) => String(n).padStart(2, '0');
  const makeRange = (sY: number, sM: number, sD: number, eY: number, eM: number, eD: number, label: string): DateRange => {
    const sIso = `${sY}-${pad(sM + 1)}-${pad(sD)}T00:00:00.000`;
    const eIso = `${eY}-${pad(eM + 1)}-${pad(eD)}T23:59:59.999`;
    return {
      startDate: fromZonedTime(sIso, timezone),
      endDate: fromZonedTime(eIso, timezone),
      label,
    };
  };

  // Quarters (e.g. Q1, Q2 2026)
  const qMatch = period.match(/^q([1-4])(?:\s+(\d{4}))?$/i);
  if (qMatch) {
    const q = parseInt(qMatch[1], 10);
    const y = qMatch[2] ? parseInt(qMatch[2], 10) : curYear;
    const startM = (q - 1) * 3;
    const endM = startM + 2;
    const lastDay = getDaysInMonth(y, endM);
    return makeRange(y, startM, 1, y, endM, lastDay, `Q${q} ${y}`);
  }

  // Last N days
  const lastDaysMatch = period.match(/^last\s+(\d+)\s+days?$/i);
  if (lastDaysMatch) {
    const n = parseInt(lastDaysMatch[1], 10);
    const startZoned = startOfDay(subDays(now, n - 1));
    const endZoned = endOfDay(now);
    return {
      startDate: fromZonedTime(startZoned, timezone),
      endDate: fromZonedTime(endZoned, timezone),
      label: `Last ${n} Days`,
    };
  }

  // Last N months
  const lastMonthsMatch = period.match(/^last\s+(\d+)\s+months?$/i);
  if (lastMonthsMatch) {
    const n = parseInt(lastMonthsMatch[1], 10);
    const startZoned = startOfMonth(subMonths(now, n - 1));
    const endZoned = endOfMonth(now);
    return {
      startDate: fromZonedTime(startZoned, timezone),
      endDate: fromZonedTime(endZoned, timezone),
      label: `Last ${n} Months`,
    };
  }

  // Range split by: -, –, —, .., to, and
  const rangeSepRegex = /\s*(?:–|—|-|\.\.+|\bto\b|\band\b)\s*/i;
  if (rangeSepRegex.test(period)) {
    const parts = period.split(rangeSepRegex);
    if (parts.length === 2) {
      const p1 = parts[0].trim();
      const p2 = parts[1].trim();

      // Check day+month range (e.g. 12th jan - 5th March, 12 Jan - 5 Mar)
      const dm1 = parseDayMonthPart(p1);
      const dm2 = parseDayMonthPart(p2);
      if (dm1 && dm2) {
        let eYear = dm2.year ?? curYear;
        let sYear = dm1.year ?? (dm2.year ?? curYear);
        if (!dm1.year && !dm2.year) {
          if (dm1.month > dm2.month || (dm1.month === dm2.month && dm1.day > dm2.day)) {
            if (now.getMonth() <= dm2.month) {
              sYear = curYear - 1;
              eYear = curYear;
            } else {
              sYear = curYear;
              eYear = curYear + 1;
            }
          }
        }
        const label = sYear === eYear
          ? `${MONTH_NAMES_SHORT[dm1.month]} ${dm1.day} – ${MONTH_NAMES_SHORT[dm2.month]} ${dm2.day}, ${sYear}`
          : `${MONTH_NAMES_SHORT[dm1.month]} ${dm1.day}, ${sYear} – ${MONTH_NAMES_SHORT[dm2.month]} ${dm2.day}, ${eYear}`;
        return makeRange(sYear, dm1.month, dm1.day, eYear, dm2.month, dm2.day, label);
      }

      // Check month range (e.g. Jan - March, Jan - Dec)
      const m1 = parseMonthPart(p1);
      const m2 = parseMonthPart(p2);
      if (m1 && m2) {
        let eYear = m2.year ?? curYear;
        let sYear = m1.year ?? (m2.year ?? curYear);
        if (!m1.year && !m2.year) {
          // If e.g. Jan - Dec, keep current year
          if (m1.month === 0 && m2.month === 11) {
            sYear = curYear;
            eYear = curYear;
          } else if (m1.month > m2.month) {
            if (now.getMonth() <= m2.month) {
              sYear = curYear - 1;
              eYear = curYear;
            } else {
              sYear = curYear;
              eYear = curYear + 1;
            }
          }
        }
        const lastDay = getDaysInMonth(eYear, m2.month);
        const label = sYear === eYear
          ? `${MONTH_NAMES_SHORT[m1.month]} – ${MONTH_NAMES_SHORT[m2.month]} ${sYear}`
          : `${MONTH_NAMES_SHORT[m1.month]} ${sYear} – ${MONTH_NAMES_SHORT[m2.month]} ${eYear}`;
        return makeRange(sYear, m1.month, 1, eYear, m2.month, lastDay, label);
      }
    }
  }

  // Single month (e.g. January, Jan, or March 2025)
  const singleMonth = parseMonthPart(period);
  if (singleMonth) {
    let y = singleMonth.year ?? curYear;
    if (!singleMonth.year && singleMonth.month > now.getMonth()) {
      y = curYear - 1;
    }
    const lastDay = getDaysInMonth(y, singleMonth.month);
    const mName = MONTH_NAMES_FULL[singleMonth.month];
    return makeRange(y, singleMonth.month, 1, y, singleMonth.month, lastDay, `${mName} ${y}`);
  }

  // Single year (e.g. 2025)
  if (/^\d{4}$/.test(period)) {
    const y = parseInt(period, 10);
    return makeRange(y, 0, 1, y, 11, 31, `${y}`);
  }

  return null;
}

/**
 * Get a date range for common period expressions or custom ranges (e.g. "Jan - March", "12th jan - 5th March").
 */
export function getDateRange(period: string, timezone = 'Africa/Lagos'): DateRange {
  const nowUtc = new Date();
  const now = toZonedTime(nowUtc, timezone);

  switch (period.toLowerCase().trim()) {
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

    default: {
      const custom = parseCustomDateRange(period, timezone);
      if (custom) return custom;

      // Default to current month
      return {
        startDate: fromZonedTime(startOfMonth(now), timezone),
        endDate: fromZonedTime(endOfMonth(now), timezone),
        label: format(now, 'MMMM yyyy'),
      };
    }
  }
}

/**
 * Build a human-friendly and filesystem-safe slug for date ranges (e.g. 2026-01_to_2026-03).
 */
export function buildDateSlug(startDate: Date, endDate: Date): string {
  const startDay = format(startDate, 'yyyy-MM-dd');
  const endDay = format(endDate, 'yyyy-MM-dd');
  if (startDay === endDay) {
    return startDay;
  }
  const startMonth = format(startDate, 'yyyy-MM');
  const endMonth = format(endDate, 'yyyy-MM');
  if (startMonth === endMonth) {
    if (format(startDate, 'dd') === '01' && format(endDate, 'dd') === format(endOfMonth(startDate), 'dd')) {
      return startMonth;
    }
    return `${startDay}_to_${format(endDate, 'dd')}`;
  }
  if (format(startDate, 'dd') === '01' && format(endDate, 'dd') === format(endOfMonth(endDate), 'dd')) {
    return `${startMonth}_to_${endMonth}`;
  }
  return `${startDay}_to_${endDay}`;
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
