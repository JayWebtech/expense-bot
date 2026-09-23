import { Bot } from 'grammy';
import { BotContext } from '../../infrastructure/telegram/bot';
import { handleStart } from './handlers/start.handler';
import { handleHelp } from './handlers/help.handler';
import { handleCancel } from './handlers/cancel.handler';
import { handleUnknownCommand } from './handlers/unknown.handler';
import { handleTextMessage } from './handlers/text.handler';
import { handleVoiceMessage } from './handlers/voice.handler';
import { logger } from '../../shared/logger';

/**
 * Register all Telegram bot commands and handlers.
 * Each handler is kept thin — business logic lives in service modules.
 */
export function registerBotHandlers(bot: Bot<BotContext>): void {
  // ── Commands ──────────────────────────────────────────────────────────────

  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('cancel', handleCancel);

  // Stubs for commands implemented in later phases
  bot.command('balance', async (ctx) => {
    await ctx.reply('📊 Balance feature coming in Phase 5. Use /help to see available options.');
  });

  bot.command('summary', async (ctx) => {
    await ctx.reply('📈 Summary feature coming in Phase 5.');
  });

  bot.command('expenses', async (ctx) => {
    await ctx.reply('💸 Expense listing coming in Phase 5.');
  });

  bot.command('income', async (ctx) => {
    await ctx.reply('💵 Income listing coming in Phase 5.');
  });

  bot.command('report', async (ctx) => {
    await ctx.reply('📄 PDF report generation coming in Phase 6.');
  });

  bot.command('export', async (ctx) => {
    await ctx.reply('📁 CSV export coming in Phase 6.');
  });

  bot.command('categories', async (ctx) => {
    await ctx.reply('🏷️ Category management coming in Phase 2.');
  });

  bot.command('budget', async (ctx) => {
    await ctx.reply('💰 Budget tracking coming in Phase 5.');
  });

  bot.command('reminders', async (ctx) => {
    await ctx.reply('🔔 Reminders coming in Phase 5.');
  });

  bot.command('settings', async (ctx) => {
    await ctx.reply('⚙️ Settings coming soon. Use /help to see available features.');
  });

  // ── Message types ──────────────────────────────────────────────────────────

  bot.on('message:voice', handleVoiceMessage);
  bot.on('message:text', handleTextMessage);

  // ── Callback queries (inline buttons) ─────────────────────────────────────

  bot.callbackQuery('help', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleHelp(ctx);
  });

  bot.callbackQuery('balance', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('📊 Balance feature coming soon!');
  });

  bot.callbackQuery('settings', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('⚙️ Settings coming soon!');
  });

  bot.callbackQuery('categories', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('🏷️ Category management coming soon!');
  });

  // ── Unknown commands ───────────────────────────────────────────────────────
  bot.on('message:entities:bot_command', handleUnknownCommand);

  logger.info('Telegram bot handlers registered');
}
