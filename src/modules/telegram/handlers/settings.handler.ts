import { InlineKeyboard } from 'grammy';
import { BotContext } from '../../../infrastructure/telegram/bot';
import { userService } from '../../users/user.service';
import { SUPPORTED_CURRENCIES } from '../../../shared/types';
import { logger } from '../../../shared/logger';

export async function handleSettings(ctx: BotContext): Promise<void> {
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

    const keyboard = new InlineKeyboard()
      .text('Change Currency', 'settings_currency')
      .row()
      .text('Change Timezone', 'settings_timezone')
      .row()
      .text('Delete Account', 'settings_delete');

    await ctx.reply(
      `⚙️ *Settings*\n\n` +
      `*Name:* ${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}\n` +
      `*Currency:* ${user.defaultCurrency}\n` +
      `*Timezone:* ${user.timezone}\n\n`,
      { parse_mode: 'Markdown', reply_markup: keyboard },
    );
  } catch (err) {
    logger.error({ err }, 'Settings handler failed');
    await ctx.reply('Failed to load settings.');
  }
}
