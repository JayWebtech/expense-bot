import { prisma } from '../../infrastructure/database/client';
import { Transaction, TransactionType, TransactionSource } from '@prisma/client';

export interface CreateTransactionInput {
  userId: string;
  type: TransactionType;
  amountMinor: bigint;
  currency: string;
  categoryId?: string | null;
  description: string;
  notes?: string;
  transactionDate: Date;
  source: TransactionSource;
  metadata?: Record<string, unknown>;
}

export interface UpdateTransactionInput {
  type?: TransactionType;
  amountMinor?: bigint;
  currency?: string;
  categoryId?: string | null;
  description?: string;
  notes?: string;
  transactionDate?: Date;
}

export interface TransactionFilters {
  userId: string;
  type?: TransactionType;
  currency?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface TransactionWithCategory extends Transaction {
  category: { id: string; name: string; icon: string | null } | null;
}

export class TransactionRepository {
  async create(input: CreateTransactionInput): Promise<Transaction> {
    return prisma.transaction.create({
      data: {
        userId: input.userId,
        type: input.type,
        amountMinor: input.amountMinor,
        currency: input.currency,
        categoryId: input.categoryId ?? null,
        description: input.description,
        notes: input.notes ?? null,
        transactionDate: input.transactionDate,
        source: input.source,
        metadata: input.metadata as any,
      },
    });
  }

  async update(id: string, userId: string, input: UpdateTransactionInput): Promise<Transaction> {
    return prisma.transaction.update({ where: { id, userId }, data: input });
  }

  async softDelete(id: string, userId: string): Promise<Transaction> {
    return prisma.transaction.update({
      where: { id, userId },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  async findById(id: string, userId: string): Promise<TransactionWithCategory | null> {
    return prisma.transaction.findFirst({
      where: { id, userId, isDeleted: false },
      include: { category: { select: { id: true, name: true, icon: true } } },
    }) as Promise<TransactionWithCategory | null>;
  }

  async findWithFilters(filters: TransactionFilters): Promise<{
    transactions: TransactionWithCategory[];
    total: number;
  }> {
    const { userId, type, currency, categoryId, startDate, endDate, page = 1, limit = 20 } = filters;

    const where: Record<string, unknown> = { userId, isDeleted: false };
    if (type) where['type'] = type;
    if (currency) where['currency'] = currency;
    if (categoryId) where['categoryId'] = categoryId;
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter['gte'] = startDate;
      if (endDate) dateFilter['lte'] = endDate;
      where['transactionDate'] = dateFilter;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: where as any,
        include: { category: { select: { id: true, name: true, icon: true } } },
        orderBy: { transactionDate: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.transaction.count({ where: where as any }),
    ]);

    return { transactions: transactions as TransactionWithCategory[], total };
  }

  async softDeleteAll(userId: string): Promise<number> {
    const result = await prisma.transaction.updateMany({
      where: { userId, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return result.count;
  }

  async checkDuplicate(params: {
    userId: string;
    amountMinor: bigint;
    currency: string;
    type: TransactionType;
    withinMinutes?: number;
  }): Promise<Transaction | null> {
    const minutesAgo = new Date(Date.now() - (params.withinMinutes ?? 5) * 60 * 1000);
    return prisma.transaction.findFirst({
      where: {
        userId: params.userId,
        amountMinor: params.amountMinor,
        currency: params.currency,
        type: params.type,
        isDeleted: false,
        createdAt: { gte: minutesAgo },
      },
    });
  }
}

export const transactionRepository = new TransactionRepository();
