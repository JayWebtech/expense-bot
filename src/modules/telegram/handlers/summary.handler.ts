import { BotContext } from '../../../infrastructure/telegram/bot';
import { userService } from '../../users/user.service';
import { analyticsService } from '../../analytics/analytics.service';
import { formatMoney } from '../../../shared/utils/money';
import { getDateRange } from '../../../shared/utils/date';
import { Currency } from '../../../shared/types';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

export async function handleSummary(ctx: BotContext, period = 'this_month'): Promise<void> {
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
    const { startDate, endDate, label } = getDateRange(period, tz);
    const summary = await analyticsService.getSummary(user.id, startDate, endDate, currency, label);

    if (summary.transactionCount === 0) {
      await ctx.reply(
        `📊 *${label}*\n\nNo transactions recorded for this period.`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const netSign = summary.net >= 0n ? '+' : '-';
    const absNet = summary.net < 0n ? -summary.net : summary.net;

    let text =
      `📊 *${label}*\n\n` +
      `Income:   \`${formatMoney(summary.income, currency)}\`\n` +
      `Expenses: \`${formatMoney(summary.expenses, currency)}\`\n` +
      `Net:      \`${netSign}${formatMoney(absNet, currency)}\`\n`;

    if (summary.byCategory.length > 0) {
      text += `\n*Top Expenses:*\n`;
      for (const cat of summary.byCategory.slice(0, 5)) {
        const pct = Math.round(cat.percentage);
        text += `${cat.categoryIcon} ${cat.categoryName} — \`${formatMoney(cat.total, currency)}\` (${pct}%)\n`;
      }
    }

    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error({ err }, 'Summary handler failed');
    await ctx.reply('Failed to load summary. Please try again.');
  }
}
