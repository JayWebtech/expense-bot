import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { parseDateExpression, getDateRange, formatDateInTz, buildDateSlug } from '../../../src/shared/utils/date';

const TIMEZONE = 'Africa/Lagos';

describe('parseDateExpression', () => {
  beforeEach(() => {
    // Fix "now" to 2026-09-23 for deterministic tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses "today"', () => {
    const result = parseDateExpression('today', TIMEZONE);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8); // September (0-indexed)
  });

  it('parses "yesterday"', () => {
    const result = parseDateExpression('yesterday', TIMEZONE);
    // Should be September 22
    const inLagos = new Date(result.toLocaleString('en-US', { timeZone: TIMEZONE }));
    expect(inLagos.getDate()).toBe(22);
    expect(inLagos.getMonth()).toBe(8);
  });

  it('parses "tomorrow"', () => {
    const result = parseDateExpression('tomorrow', TIMEZONE);
    const inLagos = new Date(result.toLocaleString('en-US', { timeZone: TIMEZONE }));
    expect(inLagos.getDate()).toBe(24);
  });

  it('parses "3 days ago"', () => {
    const result = parseDateExpression('3 days ago', TIMEZONE);
    const inLagos = new Date(result.toLocaleString('en-US', { timeZone: TIMEZONE }));
    expect(inLagos.getDate()).toBe(20);
  });

  it('parses ISO date string', () => {
    const result = parseDateExpression('2026-09-15', TIMEZONE);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(15);
  });

  it('defaults to today for unknown expressions', () => {
    const result = parseDateExpression('some random phrase', TIMEZONE);
    const today = new Date('2026-09-23T12:00:00Z');
    expect(result.getFullYear()).toBe(today.getFullYear());
  });

  it('is case-insensitive', () => {
    const lower = parseDateExpression('today', TIMEZONE);
    const upper = parseDateExpression('TODAY', TIMEZONE);
    expect(lower.getTime()).toBe(upper.getTime());
  });
});

describe('getDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today range', () => {
    const range = getDateRange('today', TIMEZONE);
    expect(range.label).toBe('Today');
    expect(range.startDate).toBeDefined();
    expect(range.endDate).toBeDefined();
    expect(range.startDate.getTime()).toBeLessThan(range.endDate.getTime());
  });

  it('returns this_month range', () => {
    const range = getDateRange('this_month', TIMEZONE);
    expect(range.label).toContain('September 2026');
    expect(range.startDate.getTime()).toBeLessThan(range.endDate.getTime());
  });

  it('returns last_month range', () => {
    const range = getDateRange('last_month', TIMEZONE);
    expect(range.label).toContain('August 2026');
  });

  it('start is before end for all periods', () => {
    const periods = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year'];
    for (const period of periods) {
      const range = getDateRange(period, TIMEZONE);
      expect(range.startDate.getTime(), `${period}: start < end`).toBeLessThanOrEqual(
        range.endDate.getTime(),
      );
    }
  });

  it('parses month range e.g. "Jan - March"', () => {
    const range = getDateRange('Jan - March', TIMEZONE);
    expect(range.label).toBe('Jan – Mar 2026');
    expect(range.startDate.toISOString()).toBe('2025-12-31T23:00:00.000Z'); // midnight in Lagos
    expect(range.endDate.toISOString()).toBe('2026-03-31T22:59:59.999Z');
  });

  it('parses full year month range e.g. "Jan - Dec"', () => {
    const range = getDateRange('Jan - Dec', TIMEZONE);
    expect(range.label).toBe('Jan – Dec 2026');
    expect(range.startDate.toISOString()).toBe('2025-12-31T23:00:00.000Z');
    expect(range.endDate.toISOString()).toBe('2026-12-31T22:59:59.999Z');
  });

  it('parses day + month range e.g. "12th jan - 5th March"', () => {
    const range = getDateRange('12th jan - 5th March', TIMEZONE);
    expect(range.label).toBe('Jan 12 – Mar 5, 2026');
    expect(range.startDate.toISOString()).toBe('2026-01-11T23:00:00.000Z');
    expect(range.endDate.toISOString()).toBe('2026-03-05T22:59:59.999Z');
  });

  it('strips leading export/report keywords e.g. "export Jan - March"', () => {
    const range = getDateRange('export Jan - March', TIMEZONE);
    expect(range.label).toBe('Jan – Mar 2026');
    expect(range.startDate.toISOString()).toBe('2025-12-31T23:00:00.000Z');
  });

  it('parses "Jan to March" with "to" separator', () => {
    const range = getDateRange('Jan to March', TIMEZONE);
    expect(range.label).toBe('Jan – Mar 2026');
  });

  it('parses explicit years e.g. "Jan 2025 - March 2025"', () => {
    const range = getDateRange('Jan 2025 - March 2025', TIMEZONE);
    expect(range.label).toBe('Jan – Mar 2025');
    expect(range.startDate.toISOString()).toBe('2024-12-31T23:00:00.000Z');
    expect(range.endDate.toISOString()).toBe('2025-03-31T22:59:59.999Z');
  });

  it('parses single month e.g. "January"', () => {
    const range = getDateRange('January', TIMEZONE);
    expect(range.label).toBe('January 2026');
    expect(range.startDate.toISOString()).toBe('2025-12-31T23:00:00.000Z');
    expect(range.endDate.toISOString()).toBe('2026-01-31T22:59:59.999Z');
  });

  it('parses single year e.g. "2025"', () => {
    const range = getDateRange('2025', TIMEZONE);
    expect(range.label).toBe('2025');
    expect(range.startDate.toISOString()).toBe('2024-12-31T23:00:00.000Z');
    expect(range.endDate.toISOString()).toBe('2025-12-31T22:59:59.999Z');
  });

  it('parses quarters e.g. "Q1 2026"', () => {
    const range = getDateRange('Q1 2026', TIMEZONE);
    expect(range.label).toBe('Q1 2026');
    expect(range.startDate.toISOString()).toBe('2025-12-31T23:00:00.000Z');
    expect(range.endDate.toISOString()).toBe('2026-03-31T22:59:59.999Z');
  });

  it('parses relative "last 30 days"', () => {
    const range = getDateRange('last 30 days', TIMEZONE);
    expect(range.label).toBe('Last 30 Days');
    expect(range.startDate.getTime()).toBeLessThan(range.endDate.getTime());
  });
});

describe('buildDateSlug', () => {
  it('builds month range slug for multi-month period', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-03-31T23:59:59Z');
    expect(buildDateSlug(start, end)).toBe('2026-01_to_2026-03');
  });

  it('builds single month slug for full month', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-31T23:59:59Z');
    expect(buildDateSlug(start, end)).toBe('2026-01');
  });

  it('builds day range slug for specific date range', () => {
    const start = new Date('2026-01-12T00:00:00Z');
    const end = new Date('2026-03-05T23:59:59Z');
    expect(buildDateSlug(start, end)).toBe('2026-01-12_to_2026-03-05');
  });
});

describe('formatDateInTz', () => {
  it('formats a date in the given timezone', () => {
    const date = new Date('2026-09-23T00:00:00Z');
    const result = formatDateInTz(date, 'Africa/Lagos');
    expect(result).toContain('Sep');
    expect(result).toContain('2026');
  });

  it('accepts a custom format string', () => {
    const date = new Date('2026-09-23T00:00:00Z');
    const result = formatDateInTz(date, 'Africa/Lagos', 'yyyy-MM-dd');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
