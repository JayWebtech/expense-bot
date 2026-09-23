import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  fromMinorUnits,
  formatMoney,
  addMinorUnits,
  subtractMinorUnits,
  sumMinorUnits,
  serializeMoney,
} from '../../../src/shared/utils/money';

describe('toMinorUnits', () => {
  it('converts whole NGN amount to kobo', () => {
    expect(toMinorUnits(15000, 'NGN')).toBe(1500000n);
  });

  it('converts fractional NGN amount to kobo', () => {
    expect(toMinorUnits(1500.5, 'NGN')).toBe(150050n);
  });

  it('converts USD to cents', () => {
    expect(toMinorUnits(100, 'USD')).toBe(10000n);
  });

  it('converts USD with cents', () => {
    expect(toMinorUnits(9.99, 'USD')).toBe(999n);
  });

  it('converts RWF with no minor units', () => {
    expect(toMinorUnits(5000, 'RWF')).toBe(5000n);
  });

  it('handles zero', () => {
    expect(toMinorUnits(0, 'NGN')).toBe(0n);
  });

  it('handles large amounts', () => {
    expect(toMinorUnits(1_000_000, 'NGN')).toBe(100_000_000n);
  });
});

describe('fromMinorUnits', () => {
  it('converts kobo to NGN', () => {
    expect(fromMinorUnits(1500000n, 'NGN')).toBe(15000);
  });

  it('converts cents to USD', () => {
    expect(fromMinorUnits(999n, 'USD')).toBe(9.99);
  });

  it('converts RWF (no sub-units)', () => {
    expect(fromMinorUnits(5000n, 'RWF')).toBe(5000);
  });

  it('handles zero', () => {
    expect(fromMinorUnits(0n, 'NGN')).toBe(0);
  });
});

describe('formatMoney', () => {
  it('formats NGN with symbol and commas', () => {
    const result = formatMoney(1500000n, 'NGN');
    expect(result).toContain('₦');
    expect(result).toContain('15,000');
  });

  it('formats USD with dollar sign', () => {
    const result = formatMoney(10000n, 'USD');
    expect(result).toContain('$');
    expect(result).toContain('100');
  });

  it('formats GBP with pound sign', () => {
    const result = formatMoney(5000n, 'GBP');
    expect(result).toContain('£');
    expect(result).toContain('50');
  });

  it('formats RWF as whole numbers', () => {
    const result = formatMoney(5000n, 'RWF');
    expect(result).toContain('RWF');
    expect(result).toContain('5,000');
  });

  it('formats zero correctly', () => {
    const result = formatMoney(0n, 'NGN');
    expect(result).toContain('₦');
    expect(result).toContain('0');
  });
});

describe('addMinorUnits', () => {
  it('adds two amounts', () => {
    expect(addMinorUnits(1000n, 2000n)).toBe(3000n);
  });

  it('handles zero', () => {
    expect(addMinorUnits(1000n, 0n)).toBe(1000n);
  });
});

describe('subtractMinorUnits', () => {
  it('subtracts two amounts', () => {
    expect(subtractMinorUnits(5000n, 2000n)).toBe(3000n);
  });

  it('can produce negative (overdraft)', () => {
    expect(subtractMinorUnits(1000n, 3000n)).toBe(-2000n);
  });
});

describe('sumMinorUnits', () => {
  it('sums an array of amounts', () => {
    expect(sumMinorUnits([1000n, 2000n, 3000n])).toBe(6000n);
  });

  it('returns zero for empty array', () => {
    expect(sumMinorUnits([])).toBe(0n);
  });
});

describe('serializeMoney', () => {
  it('returns all required fields', () => {
    const result = serializeMoney(1500000n, 'NGN');
    expect(result.amountMinor).toBe('1500000');
    expect(result.amount).toBe(15000);
    expect(result.currency).toBe('NGN');
    expect(result.formatted).toContain('₦');
  });
});

describe('round-trip consistency', () => {
  it('toMinorUnits then fromMinorUnits returns original', () => {
    const original = 15000;
    const minor = toMinorUnits(original, 'NGN');
    const back = fromMinorUnits(minor, 'NGN');
    expect(back).toBe(original);
  });

  it('works for USD with decimals', () => {
    const original = 99.99;
    const minor = toMinorUnits(original, 'USD');
    const back = fromMinorUnits(minor, 'USD');
    expect(back).toBeCloseTo(original, 2);
  });
});
