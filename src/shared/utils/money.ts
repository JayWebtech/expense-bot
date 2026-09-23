import { Currency, CURRENCY_CONFIG } from '../types';

/**
 * Convert a major-unit amount (e.g. 15000 NGN) to minor units (e.g. 1500000 kobo).
 * Uses string arithmetic to avoid floating-point precision errors.
 */
export function toMinorUnits(amount: number, currency: Currency): bigint {
  const { minorUnitMultiplier } = CURRENCY_CONFIG[currency];

  if (minorUnitMultiplier === 1) {
    return BigInt(Math.round(amount));
  }

  const decimals = String(minorUnitMultiplier).length - 1;
  const amountStr = amount.toFixed(decimals);
  const [whole, decimal = ''] = amountStr.split('.');
  const minorStr = whole + decimal.padEnd(decimals, '0');
  return BigInt(minorStr);
}

/**
 * Convert minor units back to major-unit amount for display.
 */
export function fromMinorUnits(amountMinor: bigint, currency: Currency): number {
  const { minorUnitMultiplier } = CURRENCY_CONFIG[currency];
  if (minorUnitMultiplier === 1) {
    return Number(amountMinor);
  }
  return Number(amountMinor) / minorUnitMultiplier;
}

/**
 * Format a minor-unit amount as a human-readable currency string.
 * e.g. 1500000n, 'NGN' → '₦15,000.00'
 */
export function formatMoney(amountMinor: bigint, currency: Currency): string {
  const cfg = CURRENCY_CONFIG[currency];
  const amount = fromMinorUnits(amountMinor, currency);
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: cfg.decimalDigits,
    maximumFractionDigits: cfg.decimalDigits,
  }).format(amount);
  return `${cfg.symbol}${formatted}`;
}

/**
 * Add two minor-unit amounts.
 */
export function addMinorUnits(a: bigint, b: bigint): bigint {
  return a + b;
}

/**
 * Subtract b from a in minor units.
 */
export function subtractMinorUnits(a: bigint, b: bigint): bigint {
  return a - b;
}

/**
 * Sum an array of minor-unit amounts.
 */
export function sumMinorUnits(amounts: bigint[]): bigint {
  return amounts.reduce((acc, v) => acc + v, 0n);
}

/**
 * Safely serialize a BigInt money amount for JSON responses.
 * Returns the minor-unit amount as a string and a formatted display string.
 */
export function serializeMoney(amountMinor: bigint, currency: Currency) {
  return {
    amountMinor: amountMinor.toString(),
    amount: fromMinorUnits(amountMinor, currency),
    currency,
    formatted: formatMoney(amountMinor, currency),
  };
}
