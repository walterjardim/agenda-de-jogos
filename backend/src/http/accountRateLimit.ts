import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from './errors.js';

export function createAccountRateLimit(app: FastifyInstance, max: number) {
  const accounts = new WeakMap<FastifyRequest, string>();
  const limit = app.createRateLimit({
    max,
    timeWindow: '1 minute',
    keyGenerator: (request) => accounts.get(request) ?? request.ip,
  });

  return async (request: FastifyRequest, reply: FastifyReply, userId: string) => {
    accounts.set(request, userId);
    const result = await limit(request);
    if (!result.isAllowed && result.isExceeded) {
      reply.header('Retry-After', result.ttlInSeconds);
      throw new ApiError(429, 'RATE_LIMITED', 'Muitas tentativas. Tente novamente em instantes.');
    }
  };
}
