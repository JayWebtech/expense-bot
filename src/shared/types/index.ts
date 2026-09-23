// Supported currencies
export type Currency = 'NGN' | 'USD' | 'EUR' | 'GBP' | 'GHS' | 'KES' | 'RWF';

export const SUPPORTED_CURRENCIES: Currency[] = [
  'NGN',
  'USD',
  'EUR',
  'GBP',
  'GHS',
  'KES',
  'RWF',
];

export interface CurrencyConfig {
  symbol: string;
  name: string;
  minorUnitMultiplier: number;
  code: Currency;
  decimalDigits: number;
}

export const CURRENCY_CONFIG: Record<Currency, CurrencyConfig> = {
  NGN: {
    symbol: '₦',
    name: 'Nigerian Naira',
    minorUnitMultiplier: 100,
    code: 'NGN',
    decimalDigits: 2,
  },
  USD: {
    symbol: '$',
    name: 'US Dollar',
    minorUnitMultiplier: 100,
    code: 'USD',
    decimalDigits: 2,
  },
  EUR: {
    symbol: '€',
    name: 'Euro',
    minorUnitMultiplier: 100,
    code: 'EUR',
    decimalDigits: 2,
  },
  GBP: {
    symbol: '£',
    name: 'British Pound',
    minorUnitMultiplier: 100,
    code: 'GBP',
    decimalDigits: 2,
  },
  GHS: {
    symbol: '₵',
    name: 'Ghanaian Cedi',
    minorUnitMultiplier: 100,
    code: 'GHS',
    decimalDigits: 2,
  },
  KES: {
    symbol: 'KES ',
    name: 'Kenyan Shilling',
    minorUnitMultiplier: 100,
    code: 'KES',
    decimalDigits: 2,
  },
  RWF: {
    symbol: 'RWF ',
    name: 'Rwandan Franc',
    minorUnitMultiplier: 1,
    code: 'RWF',
    decimalDigits: 0,
  },
};

// Transaction types
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'REFUND' | 'ADJUSTMENT';
export type TransactionSource = 'TEXT' | 'VOICE' | 'COMMAND' | 'IMPORT' | 'API' | 'RECURRING' | 'AI';
export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';

// Category icons by name (emoji map)
export const CATEGORY_ICONS: Record<string, string> = {
  Food: '🍛',
  Transport: '🚗',
  Fuel: '⛽',
  Rent: '🏠',
  Utilities: '💡',
  Internet: '🌐',
  Phone: '📱',
  Shopping: '🛍️',
  Healthcare: '🏥',
  Education: '📚',
  Entertainment: '🎬',
  Travel: '✈️',
  Salary: '💰',
  Freelance: '💻',
  Business: '💼',
  Investment: '📈',
  Gift: '🎁',
  Debt: '💳',
  Loan: '🏦',
  Other: '📌',
};

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
