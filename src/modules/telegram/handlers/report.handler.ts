import { InputFile } from 'grammy';
import { BotContext } from '../../../infrastructure/telegram/bot';
import { userService } from '../../users/user.service';
import { exportService } from '../../exports/export.service';
import { startTyping } from '../../../shared/utils/typing';
import { logger } from '../../../shared/logger';

export async function handleReport(ctx: BotContext): Promise<void> {
  const telegramUser = ctx.from;
  if (!telegramUser) return;

  const stopTyping = startTyping(ctx);
  const processingMsg = await ctx.reply('📄 Generating your PDF report...');

  try {
    const user = await userService.findOrCreateFromTelegram({
      telegramUserId: BigInt(telegramUser.id),
      telegramUsername: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
    });
    ctx.session.userId = user.id;

    const result = await exportService.exportPDF(user, 'this_month');
    stopTyping();

    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);
    await ctx.replyWithDocument(new InputFile(result.buffer, result.filename), { caption: `📄 Financial report — ${Math.round(result.bytes / 1024)} KB` });
  } catch (err) {
    stopTyping();
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, message }, 'Report handler failed');
    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);
    await ctx.reply(`❌ Failed to generate report:\n\`${message}\``, { parse_mode: 'Markdown' });
  }
}

export async function handleExport(ctx: BotContext): Promise<void> {
  const telegramUser = ctx.from;
  if (!telegramUser) return;

  const stopTyping = startTyping(ctx);
  const processingMsg = await ctx.reply('📁 Generating CSV export...');

  try {
    const user = await userService.findOrCreateFromTelegram({
      telegramUserId: BigInt(telegramUser.id),
      telegramUsername: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
    });
    ctx.session.userId = user.id;

    const result = await exportService.exportCSV(user, 'this_month');
    stopTyping();

    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);
    await ctx.replyWithDocument(new InputFile(result.buffer, result.filename), { caption: `📁 Transaction export — ${Math.round(result.bytes / 1024)} KB` });
  } catch (err) {
    stopTyping();
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, message }, 'Export handler failed');
    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);
    await ctx.reply(`❌ Failed to generate export:\n\`${message}\``, { parse_mode: 'Markdown' });
  }
}
