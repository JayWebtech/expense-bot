import { FastifyInstance } from 'fastify';

/**
 * API v1 routes — stubs for the web/mobile client API.
 * Full implementations will be added per feature in each phase.
 */
export async function apiV1Routes(fastify: FastifyInstance): Promise<void> {
  // Placeholder that will be replaced with real routes in subsequent phases
  fastify.get('/me', async (req, reply) => {
    return reply.status(501).send({ error: 'Not implemented yet' });
  });

  fastify.get('/transactions', async (req, reply) => {
    return reply.status(501).send({ error: 'Not implemented yet' });
  });

  fastify.get('/categories', async (req, reply) => {
    return reply.status(501).send({ error: 'Not implemented yet' });
  });

  fastify.get('/analytics/summary', async (req, reply) => {
    return reply.status(501).send({ error: 'Not implemented yet' });
  });
}
