import { prisma } from '../../infrastructure/database/client';
import { Budget, BudgetPeriod } from '@prisma/client';

export interface BudgetWithCategory extends Budget {
  category: { id: string; name: string; icon: string | null } | null;
}

export interface CreateBudgetInput {
  userId: string;
  categoryId?: string | null;
  name: string;
  amountMinor: bigint;
  currency: string;
  period: BudgetPeriod;
}

export class BudgetRepository {
  async findActive(userId: string): Promise<BudgetWithCategory[]> {
    return prisma.budget.findMany({
      where: { userId, isActive: true, deletedAt: null },
      include: { category: { select: { id: true, name: true, icon: true } } },
      orderBy: { createdAt: 'desc' },
    }) as Promise<BudgetWithCategory[]>;
  }

  async findByCategory(userId: string, categoryId: string | null, period: BudgetPeriod): Promise<BudgetWithCategory | null> {
    return prisma.budget.findFirst({
      where: { userId, categoryId: categoryId ?? null, period, isActive: true, deletedAt: null },
      include: { category: { select: { id: true, name: true, icon: true } } },
    }) as Promise<BudgetWithCategory | null>;
  }

  async upsert(input: CreateBudgetInput): Promise<Budget> {
    if (input.categoryId) {
      await prisma.budget.updateMany({
        where: { userId: input.userId, categoryId: input.categoryId, period: input.period, isActive: true },
        data: { isActive: false },
      });
    }
    return prisma.budget.create({
      data: {
        userId: input.userId,
        categoryId: input.categoryId ?? null,
        name: input.name,
        amountMinor: input.amountMinor,
        currency: input.currency,
        period: input.period,
        isActive: true,
      },
    });
  }
}

export const budgetRepository = new BudgetRepository();
