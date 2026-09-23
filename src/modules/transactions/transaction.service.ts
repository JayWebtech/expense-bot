import {
  transactionRepository,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilters,
  TransactionWithCategory,
} from './transaction.repository';
import { Transaction } from '@prisma/client';
import { NotFoundError, DuplicateTransactionError } from '../../shared/errors';
import { logger } from '../../shared/logger';

export class TransactionService {
  async create(input: CreateTransactionInput, skipDuplicateCheck = false): Promise<Transaction> {
    if (!skipDuplicateCheck) {
      const duplicate = await transactionRepository.checkDuplicate({
        userId: input.userId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        type: input.type,
        withinMinutes: 5,
      });
      if (duplicate) {
        throw new DuplicateTransactionError();
      }
    }
    const tx = await transactionRepository.create(input);
    logger.info({ txId: tx.id, userId: input.userId, type: input.type }, 'Transaction created');
    return tx;
  }

  async update(id: string, userId: string, input: UpdateTransactionInput): Promise<Transaction> {
    const existing = await transactionRepository.findById(id, userId);
    if (!existing) throw new NotFoundError('Transaction');
    return transactionRepository.update(id, userId, input);
  }

  async delete(id: string, userId: string): Promise<Transaction> {
    const existing = await transactionRepository.findById(id, userId);
    if (!existing) throw new NotFoundError('Transaction');
    logger.info({ txId: id, userId }, 'Transaction soft-deleted');
    return transactionRepository.softDelete(id, userId);
  }

  async getById(id: string, userId: string): Promise<TransactionWithCategory> {
    const tx = await transactionRepository.findById(id, userId);
    if (!tx) throw new NotFoundError('Transaction');
    return tx;
  }

  async list(filters: TransactionFilters): Promise<{ transactions: TransactionWithCategory[]; total: number }> {
    return transactionRepository.findWithFilters(filters);
  }

  async clearAll(userId: string): Promise<number> {
    const count = await transactionRepository.softDeleteAll(userId);
    logger.info({ userId, count }, 'All transactions cleared');
    return count;
  }
}

export const transactionService = new TransactionService();
