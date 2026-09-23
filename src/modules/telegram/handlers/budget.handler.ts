import { BotContext } from '../../../infrastructure/telegram/bot';
import { userService } from '../../users/user.service';
import { budgetService } from '../../budgets/budget.service';
import { formatMoney } from '../../../shared/utils/money';
import { Currency, CATEGORY_ICONS } from '../../../shared/types';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

export async function handleBudget(ctx: BotContext): Promise<void> {
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
    const usages = await budgetService.getAllUsage(user.id, currency, tz);

    if (usages.length === 0) {
      await ctx.reply(
        `💰 *Budgets*\n\nNo budgets set yet.\n\nTry: _"Set my food budget to 50k per month"_`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    let text = '💰 *Monthly Budgets*\n\n';
    for (const u of usages) {
      const catName = u.budget.category?.name ?? u.budget.name;
      const icon = u.budget.category
        ? (u.budget.category.icon ?? CATEGORY_ICONS[catName] ?? '📌')
        : '📊';
      const statusIcon = u.isOverBudget ? '🔴' : u.isNearLimit ? '🟡' : '🟢';
      const pct = Math.min(u.percentage, 100);
      const bar = buildBar(pct);

      text +=
        `${statusIcon} *${catName}*\n` +
        `${formatMoney(u.spent, currency)} / ${formatMoney(u.budget.amountMinor, currency)}\n` +
        `${bar} ${pct}%\n\n`;
    }

    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error({ err }, 'Budget handler failed');
    await ctx.reply('Failed to load budgets. Please try again.');
  }
}

function buildBar(percentage: number): string {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
