import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { ApiError, parseBody } from '../http/errors.js';
import type { VerifyGoogleIdentity } from './google.js';
import { createAuthService } from './service.js';

const googleLoginBody = z.strictObject({
  idToken: z.string().min(1).max(8192),
  webSession: z.enum(['cookie', 'memory']).optional(),
});
const cookieAttributes = 'Path=/; Secure; HttpOnly; SameSite=Strict';

const timezone = z
  .string()
  .max(100)
  .refine((value) => {
    if (!/^[a-z][a-z0-9_+/-]*$/i.test(value)) {
      return false;
    }
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Informe um fuso horário IANA válido');

const profileBody = z
  .strictObject({
    timezone: timezone.optional(),
    activeTeamId: z.uuid().optional(),
  })
  .refine(
    (body) => body.timezone !== undefined || body.activeTeamId !== undefined,
    'Informe o fuso horário ou o time selecionado',
  );

type AuthOptions = {
  db: PrismaClient;
  sessionTtlHours: number;
  verifyGoogleIdentity: VerifyGoogleIdentity;
  webSessionOrigin?: string;
};

export async function authRoutes(app: FastifyInstance, options: AuthOptions) {
  const auth = createAuthService(options.db, options.sessionTtlHours);

  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
  });

  app.post(
    '/auth/google',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { idToken, webSession } = parseBody(googleLoginBody, request.body);
      if (webSession === 'cookie' && (!options.webSessionOrigin ||
          request.headers.origin !== options.webSessionOrigin)) {
        throw new ApiError(403, 'FORBIDDEN', 'Origem da sessão não autorizada');
      }
      const identity = await options.verifyGoogleIdentity(idToken);
      const session = await auth.login(identity,
        webSession ? Math.min(options.sessionTtlHours, webSession === 'cookie' ? 8 : 1) : undefined,
      );
      if (webSession !== 'cookie') return session;
      reply.header('Set-Cookie', `__Host-agenda-session=${session.sessionToken}; ${cookieAttributes}; Expires=${new Date(session.expiresAt).toUTCString()}`);
      return { user: session.user, expiresAt: session.expiresAt };
    },
  );

  if (options.webSessionOrigin) {
    app.get('/auth/web/session', async (request) => {
      const { user, expiresAt } = await auth.requireSession(request.headers.authorization);
      return { user, expiresAt: expiresAt.toISOString() };
    });
  }

  app.post('/auth/logout', async (request, reply) => {
    const session = await auth.requireSession(request.headers.authorization);
    await auth.logout(session.id);
    if (options.webSessionOrigin && request.headers.origin === options.webSessionOrigin) {
      reply.header('Set-Cookie', `__Host-agenda-session=; ${cookieAttributes}; Max-Age=0`);
    }
    return reply.code(204).send();
  });

  app.get('/me', async (request) => {
    const session = await auth.requireSession(request.headers.authorization);
    return session.user;
  });

  app.patch('/me', async (request) => {
    const session = await auth.requireSession(request.headers.authorization);
    const data = parseBody(profileBody, request.body);
    return auth.updateProfile(session.user.id, data);
  });
}
