import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { LogController } from 'fastify';
import { athleteRoutes } from './athletes/routes.js';
import { competitionRoutes } from './competitions/routes.js';
import type { VerifyGoogleIdentity } from './auth/google.js';
import { authRoutes } from './auth/routes.js';
import { teamRoutes } from './teams/routes.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { ApiError, registerErrors } from './http/errors.js';

type AppOptions = {
  db: PrismaClient;
  sessionTtlHours: number;
  verifyGoogleIdentity: VerifyGoogleIdentity;
  logger?: boolean;
  corsOrigins?: string[];
};

export function buildApp(options: AppOptions) {
  const app = Fastify({
    bodyLimit: 16 * 1024,
    logger: options.logger ?? false,
    logController: new LogController({ disableRequestLogging: true }),
  });

  registerErrors(app);
  if (options.corsOrigins?.length) {
    app.register(cors, {
      origin: options.corsOrigins,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    });
  }
  app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) =>
      new ApiError(
        context.statusCode,
        'RATE_LIMITED',
        'Muitas tentativas. Tente novamente em instantes.',
      ),
  });
  app.register(authRoutes, { ...options, prefix: '/api/v1' });
  app.register(teamRoutes, { ...options, prefix: '/api/v1' });
  app.register(athleteRoutes, { ...options, prefix: '/api/v1' });
  app.register(competitionRoutes, { ...options, prefix: '/api/v1' });

  return app;
}
