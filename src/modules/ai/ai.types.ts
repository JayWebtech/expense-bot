import { z } from 'zod';

export const INTENT_TYPES = [
  'CREATE_TRANSACTION',
  'CREATE_MULTIPLE_TRANSACTIONS',
  'UPDATE_TRANSACTION',
  'DELETE_TRANSACTION',
  'GET_BALANCE',
  'GET_SUMMARY',
  'GET_CATEGORY_SUMMARY',
  'COMPARE_PERIODS',
  'SET_BUDGET',
  'GET_BUDGET',
  'GET_BUDGET_STATUS',
  'CREATE_CATEGORY',
  'EXPORT_CSV',
  'EXPORT_PDF',
  'SET_REMINDER',
  'HELP',
  'UNKNOWN',
] as const;

export type IntentType = (typeof INTENT_TYPES)[number];

export const ParsedTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'REFUND']),
  amount: z.number().positive(),
  currency: z.string().min(2).max(5),
  category: z.string().min(1),
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  notes: z.string().optional(),
});

export type ParsedTransaction = z.infer<typeof ParsedTransactionSchema>;

export const AIResponseSchema = z.object({
  intent: z.enum(INTENT_TYPES),
  confidence: z.number().min(0).max(1),
  needsConfirmation: z.boolean(),
  ambiguity: z.string().optional(),
  transactions: z.array(ParsedTransactionSchema).optional(),
  query: z
    .object({
      period: z.string().optional(),
      type: z.enum(['INCOME', 'EXPENSE', 'ALL']).nullable().optional(),
      category: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      compareTo: z.string().optional(),
    })
    .optional(),
  budget: z
    .object({
      category: z.string(),
      amount: z.number().positive(),
      currency: z.string(),
      period: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']),
    })
    .optional(),
  reminder: z
    .object({
      message: z.string(),
      cronExpr: z.string(),
      description: z.string(),
    })
    .optional(),
  update: z
    .object({
      amount: z.number().optional(),
      currency: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      date: z.string().optional(),
    })
    .optional(),
  message: z.string().optional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AIContext {
  defaultCurrency: string;
  timezone: string;
  today: string;
  yesterday: string;
  categories: string[];
  recentMessages: ConversationMessage[];
}
