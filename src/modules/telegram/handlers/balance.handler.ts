import { BotContext } from '../../../infrastructure/telegram/bot';
import { userService } from '../../users/user.service';
import { analyticsService } from '../../analytics/analytics.service';
import { formatMoney } from '../../../shared/utils/money';
import { Currency } from '../../../shared/types';
import { logger } from '../../../shared/logger';

export async function handleBalance(ctx: BotContext): Promise<void> {
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

    const balances = await analyticsService.getAllBalances(user.id);

    if (balances.length === 0) {
      await ctx.reply(
        `💰 *Balance*\n\nNo transactions yet.\n\nTry: _"Spent ₦5,000 on food"_ or _"Received 500k salary"_`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const lines: string[] = ['💰 *Your Balance*\n'];
    const defaultFirst = [...balances].sort((a) => (a.currency === user.defaultCurrency ? -1 : 1));

    for (const b of defaultFirst) {
      const cur = b.currency as Currency;
      const netSign = b.net >= 0n ? '+' : '-';
      const absNet = b.net < 0n ? -b.net : b.net;
      lines.push(
        `*${cur}*\n` +
          `Income:   \`${formatMoney(b.income, cur)}\`\n` +
          `Expenses: \`${formatMoney(b.expenses, cur)}\`\n` +
          `Net:      \`${netSign}${formatMoney(absNet, cur)}\`\n`,
      );
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error({ err, telegramUserId: telegramUser.id }, 'Balance handler failed');
    await ctx.reply('Failed to load balance. Please try again.');
  }
}
