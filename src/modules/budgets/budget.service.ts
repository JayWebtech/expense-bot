import { budgetRepository, BudgetWithCategory, CreateBudgetInput } from './budget.repository';
import { Budget } from '@prisma/client';
import { analyticsService } from '../analytics/analytics.service';
import { getDateRange } from '../../shared/utils/date';

export interface BudgetUsage {
  budget: BudgetWithCategory;
  spent: bigint;
  remaining: bigint;
  percentage: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
}

export class BudgetService {
  async getActive(userId: string): Promise<BudgetWithCategory[]> {
    return budgetRepository.findActive(userId);
  }

  async set(userId: string, input: CreateBudgetInput): Promise<Budget> {
    return budgetRepository.upsert(input);
  }

  async checkCategoryUsage(
    userId: string,
    categoryId: string | null,
    currency: string,
    timezone: string,
  ): Promise<BudgetUsage | null> {
    const budget = await budgetRepository.findByCategory(userId, categoryId, 'MONTHLY');
    if (!budget) return null;

    const { startDate, endDate } = getDateRange('this_month', timezone);
    const summary = await analyticsService.getSummary(userId, startDate, endDate, currency, 'this_month');

    const catUsage = summary.byCategory.find((b) => b.categoryId === categoryId);
    const spent = catUsage?.total ?? 0n;
    const remaining = budget.amountMinor - spent;
    const percentage = budget.amountMinor > 0n ? Number((spent * 100n) / budget.amountMinor) : 0;

    return {
      budget,
      spent,
      remaining,
      percentage,
      isOverBudget: spent > budget.amountMinor,
      isNearLimit: percentage >= 80 && spent <= budget.amountMinor,
    };
  }

  async getAllUsage(userId: string, currency: string, timezone: string): Promise<BudgetUsage[]> {
    const budgets = await budgetRepository.findActive(userId);
    const results: BudgetUsage[] = [];

    for (const budget of budgets) {
      const usage = await this.checkCategoryUsage(userId, budget.categoryId, currency, timezone);
      if (usage) results.push(usage);
    }
    return results;
  }
}

export const budgetService = new BudgetService();
