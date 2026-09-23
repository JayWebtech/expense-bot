import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../infrastructure/database/client';
import { isRedisHealthy } from '../infrastructure/redis/client';
import { config } from '../config';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  environment: string;
  services: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error' | 'skipped';
    telegram: 'ok' | 'error' | 'unknown';
  };
  uptime: number;
}

async function checkDatabase(): Promise<'ok' | 'error'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'ok';
  } catch {
    return 'error';
  }
}

async function checkRedis(): Promise<'ok' | 'error' | 'skipped'> {
  if (!config.REDIS_URL) return 'skipped';
  try {
    const healthy = await isRedisHealthy();
    return healthy ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // Simple liveness probe
  fastify.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Detailed readiness probe
  fastify.get('/health/ready', async (_req: FastifyRequest, reply: FastifyReply) => {
    const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

    const allOk = database === 'ok';
    const status: HealthStatus['status'] = allOk ? 'ok' : 'error';

    const health: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      environment: config.NODE_ENV,
      services: {
        database,
        redis,
        telegram: 'unknown',
      },
      uptime: Math.floor(process.uptime()),
    };

    return reply.status(allOk ? 200 : 503).send(health);
  });
}
