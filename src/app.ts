import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { logger } from './shared/logger';
import { healthRoutes } from './routes/health';
import { webhookRoutes } from './routes/webhooks';
import { apiV1Routes } from './routes/api/v1';
import { registerErrorHandler } from './middleware/error.middleware';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV !== 'production'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
            },
          }
        : {}),
      redact: ['req.headers.authorization', 'req.headers["x-telegram-bot-api-secret-token"]'],
    },
    trustProxy: true,
    disableRequestLogging: false,
    // BigInt serialization support
    serializerOpts: {
      ajv: { plugins: [] },
    },
  });

  // ── Security plugins ──────────────────────────────────────────────────────

  await fastify.register(helmet, {
    contentSecurityPolicy: config.NODE_ENV === 'production',
  });

  await fastify.register(cors, {
    origin: config.NODE_ENV === 'production' ? [config.APP_URL ?? ''] : true,
    credentials: true,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: { code: 'RATE_LIMIT_ERROR', message: 'Too many requests. Please slow down.' },
    }),
  });

  // ── Error handling ────────────────────────────────────────────────────────
  registerErrorHandler(fastify);

  // ── Routes ────────────────────────────────────────────────────────────────
  await fastify.register(healthRoutes);
  await fastify.register(webhookRoutes);
  await fastify.register(apiV1Routes, { prefix: '/api/v1' });

  logger.debug('Fastify app built successfully');
  return fastify;
}
