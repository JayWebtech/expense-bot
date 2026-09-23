import { BotContext } from '../../../infrastructure/telegram/bot';
import { userService } from '../../users/user.service';
import { exportService } from '../../exports/export.service';
import { logger } from '../../../shared/logger';

export async function handleReport(ctx: BotContext): Promise<void> {
  const telegramUser = ctx.from;
  if (!telegramUser) return;

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

    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);
    await ctx.replyWithDocument(result.url, { caption: `📄 Financial report — ${Math.round(result.bytes / 1024)} KB` });
  } catch (err) {
    logger.error({ err }, 'Report handler failed');
    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);
    await ctx.reply(
      'Failed to generate report. Make sure Cloudinary is configured (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).',
    );
  }
}

export async function handleExport(ctx: BotContext): Promise<void> {
  const telegramUser = ctx.from;
  if (!telegramUser) return;

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

    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);
    await ctx.replyWithDocument(result.url, { caption: `📁 Transaction export — ${Math.round(result.bytes / 1024)} KB` });
  } catch (err) {
    logger.error({ err }, 'Export handler failed');
    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);
    await ctx.reply(
      'Failed to generate export. Make sure Cloudinary is configured.',
    );
  }
}
