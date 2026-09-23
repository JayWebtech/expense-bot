import { buildApp } from './app';
import { config } from './config';
import { logger } from './shared/logger';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/client';
import { createBot } from './infrastructure/telegram/bot';
import { registerBotHandlers } from './modules/telegram/telegram.module';

async function main(): Promise<void> {
  logger.info({ env: config.NODE_ENV, port: config.PORT }, '🚀 Starting Expense Bot');

  // Connect to database
  await connectDatabase();

  // Build Fastify app
  const app = await buildApp();

  // Set up Telegram bot
  const bot = createBot();
  registerBotHandlers(bot);

  if (config.TELEGRAM_MODE === 'webhook') {
    const webhookUrl = `${config.APP_URL}/webhooks/telegram`;
    await bot.api.setWebhook(webhookUrl, {
      secret_token: config.TELEGRAM_WEBHOOK_SECRET,
      drop_pending_updates: true,
    });
    logger.info({ webhookUrl }, '✅ Telegram webhook configured');
  } else {
    // Start polling in background (non-blocking)
    bot.start({
      onStart: (info) => {
        logger.info({ username: info.username }, '✅ Telegram bot started (polling mode)');
      },
    });
  }

  // Start HTTP server
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  logger.info(`✅ HTTP server listening on port ${config.PORT}`);

  // ── Graceful shutdown ─────────────────────────────────────────────────────

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully...');

    try {
      if (config.TELEGRAM_MODE === 'polling') {
        await bot.stop();
      }
      await app.close();
      await disconnectDatabase();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
    process.exit(1);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error during startup');
  process.exit(1);
});
