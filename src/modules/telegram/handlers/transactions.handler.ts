import { BotContext } from '../../../infrastructure/telegram/bot';
import { userService } from '../../users/user.service';
import { transactionService } from '../../transactions/transaction.service';
import { formatMoney } from '../../../shared/utils/money';
import { formatDateInTz } from '../../../shared/utils/date';
import { Currency, CATEGORY_ICONS } from '../../../shared/types';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

export async function handleExpenses(ctx: BotContext): Promise<void> {
  await listTransactions(ctx, 'EXPENSE', 'Recent Expenses');
}

export async function handleIncome(ctx: BotContext): Promise<void> {
  await listTransactions(ctx, 'INCOME', 'Recent Income');
}

async function listTransactions(ctx: BotContext, type: 'EXPENSE' | 'INCOME', title: string): Promise<void> {
  const telegramUser = ctx.from;
  if (!telegramUser) return;

  try {
    const user = await userService.findOrCreateFromTelegram({
      telegramUserId: BigInt(telegramUser.id),
      telegramUsername: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
    });
    ctx.session.userId = user.id;

    const tz = user.timezone ?? config.DEFAULT_TIMEZONE;
    const currency = user.defaultCurrency as Currency;

    const { transactions, total } = await transactionService.list({
      userId: user.id,
      type: type as any,
      currency,
      limit: 10,
    });

    if (transactions.length === 0) {
      await ctx.reply(`📋 *${title}*\n\nNo transactions yet.`, { parse_mode: 'Markdown' });
      return;
    }

    let text = `📋 *${title}* (${total} total)\n\n`;
    for (const tx of transactions) {
      const icon = tx.category ? (CATEGORY_ICONS[tx.category.name] ?? '📌') : '📌';
      const dateStr = formatDateInTz(tx.transactionDate, tz, 'MMM d');
      text += `${icon} ${tx.category?.name ?? 'Uncategorized'} — \`${formatMoney(tx.amountMinor, currency)}\`\n`;
      text += `    _${tx.description}_ · ${dateStr}\n\n`;
    }

    if (total > 10) text += `_Showing 10 of ${total}. Use /report for a full export._`;

    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error({ err }, 'Transactions handler failed');
    await ctx.reply('Failed to load transactions. Please try again.');
  }
}
