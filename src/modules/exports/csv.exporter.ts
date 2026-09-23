import { stringify } from 'csv-stringify/sync';
import { format } from 'date-fns';
import { fromMinorUnits } from '../../shared/utils/money';
import { Currency } from '../../shared/types';
import { TransactionWithCategory } from '../transactions/transaction.repository';

export function generateCSV(transactions: TransactionWithCategory[]): Buffer {
  const headers = ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Description', 'Notes', 'Source'];

  const rows = transactions.map((tx) => [
    format(tx.transactionDate, 'yyyy-MM-dd'),
    tx.type,
    fromMinorUnits(tx.amountMinor, tx.currency as Currency).toFixed(2),
    tx.currency,
    tx.category?.name ?? 'Uncategorized',
    tx.description,
    tx.notes ?? '',
    tx.source,
  ]);

  const csv = stringify([headers, ...rows]);
  return Buffer.from(csv, 'utf-8');
}
