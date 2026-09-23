import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { webhookCallback } from 'grammy';
import { getBot } from '../infrastructure/telegram/bot';
import { config } from '../config';
import { logger } from '../shared/logger';

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  if (config.TELEGRAM_MODE !== 'webhook') return;

  const bot = getBot();
  const handleUpdate = webhookCallback(bot, 'fastify');

  fastify.post(
    '/webhooks/telegram',
    {},
    async (req: FastifyRequest, reply: FastifyReply) => {
      const secretToken = req.headers['x-telegram-bot-api-secret-token'];

      if (config.TELEGRAM_WEBHOOK_SECRET && secretToken !== config.TELEGRAM_WEBHOOK_SECRET) {
        logger.warn(
          { ip: req.ip, updateId: (req.body as { update_id?: number })?.update_id },
          'Rejected webhook: invalid secret token',
        );
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      try {
        await handleUpdate(req, reply);
      } catch (err) {
        logger.error({ err }, 'Error processing Telegram webhook');
        return reply.status(200).send({ ok: true }); // always 200 to prevent Telegram retries
      }
    },
  );

  logger.info('Telegram webhook route registered at POST /webhooks/telegram');
}
