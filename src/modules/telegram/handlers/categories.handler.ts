import { BotContext } from '../../../infrastructure/telegram/bot';
import { userService } from '../../users/user.service';
import { categoryService } from '../../categories/category.service';
import { logger } from '../../../shared/logger';
import { CATEGORY_ICONS } from '../../../shared/types';

export async function handleCategories(ctx: BotContext): Promise<void> {
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

    const categories = await categoryService.getAllForUser(user.id);

    if (categories.length === 0) {
      await ctx.reply('No categories found. Run /start to initialize defaults.');
      return;
    }

    const expense = categories.filter((c) => c.type === 'EXPENSE' || !c.type);
    const income = categories.filter((c) => c.type === 'INCOME');

    let text = '🏷️ *Your Categories*\n\n';

    if (expense.length > 0) {
      text += '*Expense Categories:*\n';
      for (const cat of expense) {
        const icon = cat.icon ?? CATEGORY_ICONS[cat.name] ?? '📌';
        const custom = cat.userId ? ' _(custom)_' : '';
        text += `${icon} ${cat.name}${custom}\n`;
      }
    }

    if (income.length > 0) {
      text += '\n*Income Categories:*\n';
      for (const cat of income) {
        const icon = cat.icon ?? CATEGORY_ICONS[cat.name] ?? '💰';
        const custom = cat.userId ? ' _(custom)_' : '';
        text += `${icon} ${cat.name}${custom}\n`;
      }
    }

    text += '\n_To add a category, say: "Add category Groceries"_';

    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error({ err }, 'Categories handler failed');
    await ctx.reply('Failed to load categories. Please try again.');
  }
}
