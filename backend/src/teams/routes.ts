import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createAuthService, publicProfile } from '../auth/service.js';
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
const searchQuery = z.strictObject({
  q: z.string().trim().max(100).default(''),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  mine: z.enum(['true', 'false']).default('false'),
});

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

  app.get('/teams', async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { q, cursor, limit, mine } = parseBody(searchQuery, request.query);
    // Escape LIKE wildcards so the search treats the user's text literally.
    const name = q.replace(/[\\%_]/g, '\\$&');
    const rows = await db.team.findMany({
      where: {
        name: { contains: name, mode: 'insensitive' },
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(mine === 'true' ? { OR: [{ userId: user.id }, { followers: { some: { userId: user.id } } }] } : {}),
      },
      select: { ...select, userId: true },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    const data = rows.slice(0, limit).map(({ userId, ...team }) => ({ ...team, isOwner: userId === user.id }));
    return { data, nextCursor: rows.length > limit ? data.at(-1)!.id : null };
  });

  app.get('/teams/:id', async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    const team = await db.team.findUnique({ where: { id }, select: { ...select, userId: true } });
    if (!team) throw new ApiError(404, 'NOT_FOUND', 'Time não encontrado');
    const { userId, ...details } = team;
    return { ...details, isOwner: userId === user.id };
  });

  app.post('/teams/:id/select', async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    return db.$transaction(async (tx) => {
      // Keep deletion from racing with the follow and profile writes.
      const teams = await tx.$queryRaw<{ id: string; user_id: string }[]>`
        SELECT id, user_id FROM teams WHERE id = ${id}::uuid FOR UPDATE
      `;
      if (!teams[0]) throw new ApiError(404, 'NOT_FOUND', 'Time não encontrado');
      if (teams[0].user_id !== user.id) {
        await tx.teamFollow.upsert({
          where: { userId_teamId: { userId: user.id, teamId: id } },
          create: { userId: user.id, teamId: id },
          update: {},
        });
      }
      return tx.user.update({ where: { id: user.id }, data: { activeTeamId: id }, select: publicProfile });
    });
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
