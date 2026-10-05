import { format } from 'date-fns';
import { transactionService } from '../transactions/transaction.service';
import { analyticsService } from '../analytics/analytics.service';
import { generatePDF } from './pdf.exporter';
import { generateCSV } from './csv.exporter';
import { getStorageProvider } from '../../infrastructure/storage/factory';
import { getDateRange, buildDateSlug } from '../../shared/utils/date';
import { UserWithSettings } from '../users/user.types';
import { prisma } from '../../infrastructure/database/client';
import { logger } from '../../shared/logger';

export interface ExportResult {
  url: string;
  publicId: string;
  bytes: number;
  filename: string;
  type: 'PDF' | 'CSV';
  buffer: Buffer;
  label: string;
  count: number;
}

export interface ExportOptions {
  period?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  type?: 'INCOME' | 'EXPENSE' | 'ALL';
}

function resolveRange(
  periodOrOptions?: string | ExportOptions,
  timezone = 'Africa/Lagos',
): { startDate: Date; endDate: Date; label: string; period: string } {
  if (typeof periodOrOptions === 'string') {
    const range = getDateRange(periodOrOptions, timezone);
    return { ...range, period: periodOrOptions };
  }

  if (periodOrOptions && typeof periodOrOptions === 'object') {
    if (periodOrOptions.startDate && periodOrOptions.endDate) {
      const s = typeof periodOrOptions.startDate === 'string' ? new Date(periodOrOptions.startDate) : periodOrOptions.startDate;
      const e = typeof periodOrOptions.endDate === 'string' ? new Date(periodOrOptions.endDate) : periodOrOptions.endDate;
      const label = `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')}`;
      return { startDate: s, endDate: e, label, period: periodOrOptions.period ?? 'custom' };
    }
    if (periodOrOptions.period) {
      const range = getDateRange(periodOrOptions.period, timezone);
      return { ...range, period: periodOrOptions.period };
    }
  }

  const range = getDateRange('this_month', timezone);
  return { ...range, period: 'this_month' };
}

export class ExportService {
  async exportCSV(
    user: UserWithSettings,
    periodOrOptions: string | ExportOptions = 'this_month',
  ): Promise<ExportResult> {
    const { startDate, endDate, label, period } = resolveRange(periodOrOptions, user.timezone);
    const { transactions } = await transactionService.list({
      userId: user.id,
      startDate,
      endDate,
      limit: 5000,
    });

    const buffer = generateCSV(transactions);
    const slug = buildDateSlug(startDate, endDate, user.timezone);
    let secureUrl = '';
    let publicId = `local-${Date.now()}`;

    try {
      const storage = getStorageProvider();
      const result = await storage.upload(buffer, {
        folder: 'reports',
        filename: `expenses-${user.id.slice(0, 8)}-${slug}`,
        resourceType: 'raw',
      });
      secureUrl = result.secureUrl;
      publicId = result.publicId;

      await prisma.report
        .create({
          data: {
            userId: user.id,
            type: 'CSV',
            period,
            startDate,
            endDate,
            filePath: result.publicId,
            fileSize: result.bytes,
            status: 'COMPLETED',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
        .catch(() => null);
    } catch (storageErr) {
      logger.warn({ err: storageErr }, 'Storage upload skipped or failed, providing buffer directly');
    }

    return {
      url: secureUrl,
      publicId,
      bytes: buffer.length,
      filename: `expenses-${slug}.csv`,
      type: 'CSV',
      buffer,
      label,
      count: transactions.length,
    };
  }

  async exportPDF(
    user: UserWithSettings,
    periodOrOptions: string | ExportOptions = 'this_month',
  ): Promise<ExportResult> {
    const { startDate, endDate, label, period } = resolveRange(periodOrOptions, user.timezone);
    const currency = user.defaultCurrency;

    const [{ transactions }, summary] = await Promise.all([
      transactionService.list({ userId: user.id, currency, startDate, endDate, limit: 1000 }),
      analyticsService.getSummary(user.id, startDate, endDate, currency, label),
    ]);

    const userName = `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`;
    const buffer = await generatePDF(transactions, summary, userName);
    const slug = buildDateSlug(startDate, endDate, user.timezone);
    let secureUrl = '';
    let publicId = `local-${Date.now()}`;

    try {
      const storage = getStorageProvider();
      const result = await storage.upload(buffer, {
        folder: 'reports',
        filename: `report-${user.id.slice(0, 8)}-${slug}`,
        resourceType: 'raw',
      });
      secureUrl = result.secureUrl;
      publicId = result.publicId;

      await prisma.report
        .create({
          data: {
            userId: user.id,
            type: 'PDF',
            period,
            startDate,
            endDate,
            filePath: result.publicId,
            fileSize: result.bytes,
            status: 'COMPLETED',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
        .catch(() => null);
    } catch (storageErr) {
      logger.warn({ err: storageErr }, 'Storage upload skipped or failed, providing buffer directly');
    }

    return {
      url: secureUrl,
      publicId,
      bytes: buffer.length,
      filename: `report-${slug}.pdf`,
      type: 'PDF',
      buffer,
      label,
      count: transactions.length,
    };
  }
}

export const exportService = new ExportService();
