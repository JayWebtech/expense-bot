import { prisma } from '../../infrastructure/database/client';
import { Currency, CATEGORY_ICONS } from '../../shared/types';

export interface BalanceResult {
  currency: string;
  income: bigint;
  expenses: bigint;
  net: bigint;
}

export interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string;
  total: bigint;
  transactionCount: number;
  percentage: number;
}

export interface FinancialSummary {
  income: bigint;
  expenses: bigint;
  net: bigint;
  currency: string;
  byCategory: CategoryBreakdown[];
  transactionCount: number;
  label: string;
}

export class AnalyticsService {
  async getAllBalances(userId: string): Promise<BalanceResult[]> {
    const rows = await prisma.transaction.groupBy({
      by: ['currency', 'type'],
      where: { userId, isDeleted: false },
      _sum: { amountMinor: true },
    });

    const byCurrency = new Map<string, { income: bigint; expenses: bigint }>();
    for (const row of rows) {
      const cur = row.currency;
      if (!byCurrency.has(cur)) byCurrency.set(cur, { income: 0n, expenses: 0n });
      const entry = byCurrency.get(cur)!;
      const total = row._sum.amountMinor ?? 0n;
      if (row.type === 'INCOME' || row.type === 'REFUND') {
        entry.income += total;
      } else if (row.type === 'EXPENSE' || row.type === 'ADJUSTMENT') {
        entry.expenses += total;
      }
    }

    return Array.from(byCurrency.entries()).map(([currency, { income, expenses }]) => ({
      currency,
      income,
      expenses,
      net: income - expenses,
    }));
  }

  async getBalance(userId: string, currency: string): Promise<BalanceResult> {
    const all = await this.getAllBalances(userId);
    return all.find((b) => b.currency === currency) ?? { currency, income: 0n, expenses: 0n, net: 0n };
  }

  async getSummary(
    userId: string,
    startDate: Date,
    endDate: Date,
    currency: string,
    label: string,
  ): Promise<FinancialSummary> {
    const transactions = await prisma.transaction.findMany({
      where: { userId, currency, isDeleted: false, transactionDate: { gte: startDate, lte: endDate } },
      include: { category: { select: { id: true, name: true, icon: true } } },
    });

    let income = 0n;
    let expenses = 0n;
    const catMap = new Map<string, { name: string; icon: string; total: bigint; count: number }>();

    for (const tx of transactions) {
      const catKey = tx.categoryId ?? '__none__';
      const catName = tx.category?.name ?? 'Uncategorized';
      const catIcon = tx.category?.icon ?? CATEGORY_ICONS[catName] ?? '📌';

      if (tx.type === 'INCOME' || tx.type === 'REFUND') {
        income += tx.amountMinor;
      } else if (tx.type === 'EXPENSE' || tx.type === 'ADJUSTMENT') {
        expenses += tx.amountMinor;
        const existing = catMap.get(catKey);
        if (existing) {
          existing.total += tx.amountMinor;
          existing.count++;
        } else {
          catMap.set(catKey, { name: catName, icon: catIcon, total: tx.amountMinor, count: 1 });
        }
      }
    }

    const byCategory: CategoryBreakdown[] = Array.from(catMap.entries())
      .map(([catId, d]) => ({
        categoryId: catId === '__none__' ? null : catId,
        categoryName: d.name,
        categoryIcon: d.icon,
        total: d.total,
        transactionCount: d.count,
        percentage: expenses > 0n ? Number((d.total * 100n) / expenses) : 0,
      }))
      .sort((a, b) => (b.total > a.total ? 1 : -1));

    return { income, expenses, net: income - expenses, currency, byCategory, transactionCount: transactions.length, label };
  }
}

export const analyticsService = new AnalyticsService();
