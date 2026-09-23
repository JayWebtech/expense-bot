import { format } from 'date-fns';
import { transactionService } from '../transactions/transaction.service';
import { analyticsService } from '../analytics/analytics.service';
import { generatePDF } from './pdf.exporter';
import { generateCSV } from './csv.exporter';
import { getStorageProvider } from '../../infrastructure/storage/factory';
import { getDateRange } from '../../shared/utils/date';
import { UserWithSettings } from '../users/user.types';
import { prisma } from '../../infrastructure/database/client';

export interface ExportResult {
  url: string;
  publicId: string;
  bytes: number;
  filename: string;
  type: 'PDF' | 'CSV';
  buffer: Buffer;
}

export class ExportService {
  async exportCSV(user: UserWithSettings, period = 'this_month'): Promise<ExportResult> {
    const { startDate, endDate } = getDateRange(period, user.timezone);
    const { transactions } = await transactionService.list({
      userId: user.id,
      startDate,
      endDate,
      limit: 5000,
    });

    const buffer = generateCSV(transactions);
    const slug = format(startDate, 'yyyy-MM');
    const storage = getStorageProvider();
    const result = await storage.upload(buffer, {
      folder: 'reports',
      filename: `expenses-${user.id.slice(0, 8)}-${slug}`,
      resourceType: 'raw',
    });

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

    return { url: result.secureUrl, publicId: result.publicId, bytes: result.bytes, filename: `expenses-${slug}.csv`, type: 'CSV', buffer };
  }

  async exportPDF(user: UserWithSettings, period = 'this_month'): Promise<ExportResult> {
    const { startDate, endDate, label } = getDateRange(period, user.timezone);
    const currency = user.defaultCurrency;

    const [{ transactions }, summary] = await Promise.all([
      transactionService.list({ userId: user.id, currency, startDate, endDate, limit: 200 }),
      analyticsService.getSummary(user.id, startDate, endDate, currency, label),
    ]);

    const userName = `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`;
    const buffer = await generatePDF(transactions, summary, userName);
    const slug = format(startDate, 'yyyy-MM');
    const storage = getStorageProvider();
    const result = await storage.upload(buffer, {
      folder: 'reports',
      filename: `report-${user.id.slice(0, 8)}-${slug}`,
      resourceType: 'raw',
    });

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

    return { url: result.secureUrl, publicId: result.publicId, bytes: result.bytes, filename: `report-${slug}.pdf`, type: 'PDF', buffer };
  }
}

export const exportService = new ExportService();
