import { BotContext } from '../../../infrastructure/telegram/bot';
import { userService } from '../../users/user.service';
import { logger } from '../../../shared/logger';
import { InlineKeyboard } from 'grammy';

export async function handleStart(ctx: BotContext): Promise<void> {
  const telegramUser = ctx.from;
  if (!telegramUser) return;

  logger.info({ telegramUserId: telegramUser.id }, 'User started bot');

  try {
    const user = await userService.findOrCreateFromTelegram({
      telegramUserId: BigInt(telegramUser.id),
      telegramUsername: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
    });

    // Store user ID in session
    ctx.session.userId = user.id;

    const isNewUser = !user.settings;
    const greeting = isNewUser ? 'Welcome' : 'Welcome back';
    const name = telegramUser.first_name;

    const keyboard = new InlineKeyboard()
      .text('📊 View Balance', 'balance')
      .text('💡 Help', 'help')
      .row()
      .text('⚙️ Settings', 'settings')
      .text('📋 Categories', 'categories');

    await ctx.reply(
      `👋 ${greeting}, *${name}*!\n\n` +
        `I'm your personal finance assistant. I help you track income, expenses, and understand your spending patterns.\n\n` +
        `*What I can do:*\n` +
        `• Record transactions from natural text\n` +
        `• Process voice notes\n` +
        `• Generate reports (PDF/CSV)\n` +
        `• Track budgets and set reminders\n` +
        `• Answer financial questions\n\n` +
        `*Quick start:*\n` +
        `Just send me a message like:\n` +
        `_"Spent ₦5,000 on lunch"_\n` +
        `_"Received ₦200,000 salary today"_\n\n` +
        `Type /help to see all commands.`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      },
    );
  } catch (error) {
    logger.error({ error, telegramUserId: telegramUser.id }, 'Failed to handle /start');
    await ctx.reply(
      "Hi! I'm your personal finance assistant.\n\nSomething went wrong during setup. Please try again in a moment.",
    );
  }
}
