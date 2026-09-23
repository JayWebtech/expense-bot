import { Bot, Context, SessionFlavor, session } from 'grammy';
import { config } from '../../config';
import { logger } from '../../shared/logger';

// Session data stored per conversation
export interface SessionData {
  userId?: string;
  lastTransactionId?: string;
  awaitingConfirmation?: {
    type: string;
    data: unknown;
    expiresAt: number;
  };
  onboardingStep?: string;
}

export type BotContext = Context & SessionFlavor<SessionData>;

function initial(): SessionData {
  return {};
}

let botInstance: Bot<BotContext> | null = null;

export function createBot(): Bot<BotContext> {
  if (botInstance) return botInstance;

  const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);

  // In-memory sessions (will be replaced with Redis in Phase 5)
  bot.use(session({ initial }));

  // Global error handler
  bot.catch((err) => {
    logger.error(
      {
        updateId: err.ctx.update.update_id,
        error: err.error instanceof Error ? err.error.message : String(err.error),
      },
      'Unhandled bot error',
    );
  });

  botInstance = bot;
  return bot;
}

export function getBot(): Bot<BotContext> {
  if (!botInstance) {
    throw new Error('Bot not initialized. Call createBot() first.');
  }
  return botInstance;
}

export default createBot;
