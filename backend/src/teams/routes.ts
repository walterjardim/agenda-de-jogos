import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createAuthService } from '../auth/service.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { ApiError, parseBody } from '../http/errors.js';

const teamBody = z.strictObject({
  name: z.string().trim().min(1).max(100),
  sport: z.string().trim().min(1).max(60),
  category: z.string().trim().min(1).max(60),
});
const updateBody = teamBody.partial().refine((data) => Object.keys(data).length > 0);
const params = z.object({ id: z.uuid() });
const select = { id: true, name: true, sport: true, category: true, createdAt: true } as const;

export async function teamRoutes(
  app: FastifyInstance,
  options: { db: PrismaClient; sessionTtlHours: number },
) {
  const { db } = options;
  const auth = createAuthService(db, options.sessionTtlHours);
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
  });

  app.get('/me/teams', async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    return db.team.findMany({ where: { userId: user.id }, select, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  });

  app.post('/teams', async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const data = parseBody(teamBody, request.body);
    const team = await db.team.create({ data: { ...data, userId: user.id }, select });
    return reply.code(201).send(team);
  });

  app.patch('/teams/:id', async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    const data = parseBody(updateBody, request.body);
    // Ownership is part of the mutation itself, avoiding a check/write race.
    const teams = await db.team.updateManyAndReturn({ where: { id, userId: user.id }, data, select });
    if (!teams[0]) throw new ApiError(404, 'NOT_FOUND', 'Time não encontrado');
    return teams[0];
  });

  app.delete('/teams/:id', async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    const result = await db.team.deleteMany({ where: { id, userId: user.id } });
    if (!result.count) throw new ApiError(404, 'NOT_FOUND', 'Time não encontrado');
    return reply.code(204).send();
  });
}
