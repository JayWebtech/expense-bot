import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../shared/errors';
import { logger } from '../shared/logger';

export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler(
    (error: FastifyError | AppError | Error, req: FastifyRequest, reply: FastifyReply) => {
      const requestId = req.id;

      if (error instanceof AppError) {
        if (!error.isOperational) {
          logger.error({ error, requestId }, 'Non-operational error');
        } else {
          logger.warn({ code: error.code, message: error.message, requestId }, 'Operational error');
        }

        return reply.status(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      // Fastify validation errors
      if ('validation' in error && error.validation) {
        logger.debug({ validation: error.validation, requestId }, 'Validation error');
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
          },
        });
      }

      // Unexpected errors — don't leak internals
      logger.error({ error, requestId }, 'Unexpected server error');
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    },
  );

  // 404 handler
  fastify.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.url} not found`,
      },
    });
  });
}
