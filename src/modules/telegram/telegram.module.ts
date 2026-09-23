import { Bot } from 'grammy';
import { BotContext } from '../../infrastructure/telegram/bot';
import { handleStart } from './handlers/start.handler';
import { handleHelp } from './handlers/help.handler';
import { handleCancel } from './handlers/cancel.handler';
import { handleUnknownCommand } from './handlers/unknown.handler';
import { handleTextMessage, processPendingConfirmation } from './handlers/text.handler';
import { handleVoiceMessage } from './handlers/voice.handler';
import { handleBalance } from './handlers/balance.handler';
import { handleSummary } from './handlers/summary.handler';
import { handleExpenses, handleIncome } from './handlers/transactions.handler';
import { handleReport, handleExport } from './handlers/report.handler';
import { handleCategories } from './handlers/categories.handler';
import { handleBudget } from './handlers/budget.handler';
import { handleSettings } from './handlers/settings.handler';
import { transactionService } from '../transactions/transaction.service';
import { userService } from '../users/user.service';
import { logger } from '../../shared/logger';

export function registerBotHandlers(bot: Bot<BotContext>): void {
  // ── Commands ────────────────────────────────────────────────────────────────
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('cancel', handleCancel);
  bot.command('balance', handleBalance);
  bot.command('summary', (ctx) => handleSummary(ctx, 'this_month'));
  bot.command('expenses', handleExpenses);
  bot.command('income', handleIncome);
  bot.command('report', handleReport);
  bot.command('export', handleExport);
  bot.command('categories', handleCategories);
  bot.command('budget', handleBudget);
  bot.command('settings', handleSettings);

  // ── Message types ──────────────────────────────────────────────────────────
  bot.on('message:voice', handleVoiceMessage);
  bot.on('message:audio', handleVoiceMessage);

  // Text messages — handle pending confirmations first, then AI
  bot.on('message:text', async (ctx) => {
    const text = ctx.message?.text?.toLowerCase().trim() ?? '';

    // Check pending confirmation
    if (ctx.session.awaitingConfirmation) {
      const pending = ctx.session.awaitingConfirmation;
      if (Date.now() > pending.expiresAt) {
        ctx.session.awaitingConfirmation = undefined;
        // Fall through to normal text handling
      } else if (text === 'yes' || text === 'y' || text === 'confirm' || text === 'ok' || text === 'sure') {
        const telegramUser = ctx.from;
        if (!telegramUser) return;
        try {
          const user = await userService.findOrCreateFromTelegram({
            telegramUserId: BigInt(telegramUser.id),
            telegramUsername: telegramUser.username,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
          });
          await processPendingConfirmation(ctx, pending, user);
        } catch (err) {
          logger.error({ err }, 'Confirmation processing failed');
          await ctx.reply('Something went wrong. Please try again.');
        }
        return;
      } else if (text === 'no' || text === 'n' || text === 'cancel') {
        ctx.session.awaitingConfirmation = undefined;
        await ctx.reply('Cancelled.');
        return;
      } else if (text === 'record duplicate') {
        const telegramUser = ctx.from;
        if (!telegramUser) return;
        const pending2 = ctx.session.awaitingConfirmation;
        ctx.session.awaitingConfirmation = { ...pending2, skipDuplicateCheck: true };
        try {
          const user = await userService.findOrCreateFromTelegram({
            telegramUserId: BigInt(telegramUser.id),
            telegramUsername: telegramUser.username,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
          });
          await processPendingConfirmation(ctx, ctx.session.awaitingConfirmation!, user);
        } catch (err) {
          logger.error({ err }, 'Duplicate override failed');
        }
        return;
      }
    }

    await handleTextMessage(ctx);
  });

  // ── Callback queries ─────────────────────────────────────────────────────────

  // Undo last transaction
  bot.callbackQuery(/^undo:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const txId = ctx.match[1];
    const userId = ctx.session.userId;

    if (!userId) {
      await ctx.editMessageText('Session expired. Please use /start.');
      return;
    }

    try {
      await transactionService.delete(txId, userId);
      await ctx.editMessageText('✅ Transaction undone.');
      ctx.session.lastTransactionId = undefined;
    } catch {
      await ctx.reply('Could not undo — the transaction may already have been deleted.');
    }
  });

  // Confirm delete
  bot.callbackQuery(/^confirm_delete:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const txId = ctx.match[1];
    const userId = ctx.session.userId;

    if (!userId) {
      await ctx.editMessageText('Session expired. Please use /start.');
      return;
    }

    try {
      await transactionService.delete(txId, userId);
      await ctx.editMessageText('✅ Transaction deleted.');
      ctx.session.lastTransactionId = undefined;
    } catch {
      await ctx.reply('Could not delete — the transaction may already have been removed.');
    }
  });

  // Nav buttons
  bot.callbackQuery('help', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleHelp(ctx);
  });

  bot.callbackQuery('balance', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleBalance(ctx);
  });

  bot.callbackQuery('settings', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleSettings(ctx);
  });

  bot.callbackQuery('categories', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleCategories(ctx);
  });

  // Force-record expense even when balance is low/zero
  bot.callbackQuery('force_expense', async (ctx) => {
    await ctx.answerCallbackQuery();
    const pending = ctx.session.awaitingConfirmation;
    if (!pending || Date.now() > pending.expiresAt) {
      await ctx.editMessageText('This confirmation has expired. Please try again.').catch(() => null);
      return;
    }

    ctx.session.awaitingConfirmation = undefined;
    const telegramUser = ctx.from;
    if (!telegramUser) return;

    try {
      const user = await userService.findOrCreateFromTelegram({
        telegramUserId: BigInt(telegramUser.id),
        telegramUsername: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
      });
      await ctx.editMessageText('Processing...').catch(() => null);
      await processPendingConfirmation(ctx, { ...pending, skipBalanceCheck: true }, user);
    } catch (err) {
      logger.error({ err }, 'force_expense callback failed');
      await ctx.reply('Something went wrong. Please try again.');
    }
  });

  bot.callbackQuery('confirm_clear_all', async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.session.userId;
    if (!userId) {
      await ctx.editMessageText('Session expired. Please use /start.');
      return;
    }
    try {
      const count = await transactionService.clearAll(userId);
      await ctx.editMessageText(`✅ Done. ${count} transaction${count === 1 ? '' : 's'} deleted.`);
    } catch {
      await ctx.reply('Something went wrong. Please try again.');
    }
  });

  bot.callbackQuery('cancel', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.awaitingConfirmation = undefined;
    await ctx.editMessageText('Cancelled.').catch(() => ctx.reply('Cancelled.'));
  });

  // ── Unknown commands ─────────────────────────────────────────────────────────
  bot.on('message:entities:bot_command', handleUnknownCommand);

  logger.info('Telegram bot handlers registered');
}
