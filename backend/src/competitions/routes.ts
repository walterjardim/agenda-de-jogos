import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createAuthService } from '../auth/service.js';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { ApiError, parseBody } from '../http/errors.js';

const body = z.strictObject({ name: z.string().trim().min(1).max(120) });
const teamParams = z.object({ teamId: z.uuid() });
const params = z.object({ id: z.uuid() });
const cursor = z.string().max(64).transform((value) =>
  Buffer.from(value, 'base64url').toString('utf8'),
).pipe(z.uuid());
const query = z.strictObject({
  cursor: cursor.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});
const select = { id: true, teamId: true, name: true } as const;
const notFound = () => new ApiError(404, 'NOT_FOUND', 'Competição não encontrada');
const forbidden = () => new ApiError(403, 'FORBIDDEN', 'Somente o criador do time pode alterar competições');

export async function competitionRoutes(
  app: FastifyInstance,
  options: { db: PrismaClient; sessionTtlHours: number },
) {
  const { db } = options;
  const auth = createAuthService(db, options.sessionTtlHours);

  async function rejectUnavailable(id: string, userId: string): Promise<never> {
    const visible = await db.competition.findUnique({
      where: { id, team: { userId: { not: userId }, followers: { some: { userId } } } },
      select: { id: true },
    });
    throw visible ? forbidden() : notFound();
  }

  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
  });

  app.get('/teams/:teamId/competitions', async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { teamId } = parseBody(teamParams, request.params);
    const { cursor, limit } = parseBody(query, request.query);
    const team = await db.team.findUnique({
      where: {
        id: teamId,
        OR: [{ userId: user.id }, { followers: { some: { userId: user.id } } }],
      },
      select: {
        competitions: {
          where: cursor ? { id: { gt: cursor } } : {},
          select,
          orderBy: { id: 'asc' },
          take: limit + 1,
        },
      },
    });
    if (!team) throw new ApiError(404, 'NOT_FOUND', 'Time não encontrado');
    const data = team.competitions.slice(0, limit);
    return {
      data,
      nextCursor: team.competitions.length > limit
        ? Buffer.from(data.at(-1)!.id).toString('base64url')
        : null,
    };
  });

  app.post('/teams/:teamId/competitions', async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { teamId } = parseBody(teamParams, request.params);
    const data = parseBody(body, request.body);
    try {
      const competition = await db.competition.create({
        data: { ...data, team: { connect: { id: teamId, userId: user.id } } },
        select,
      });
      return reply.code(201).send(competition);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2025', 'P2018', 'P2003'].includes(error.code)) {
        const followed = await db.teamFollow.findUnique({
          where: { userId_teamId: { userId: user.id, teamId } },
          select: { teamId: true },
        });
        throw followed ? forbidden() : new ApiError(404, 'NOT_FOUND', 'Time não encontrado');
      }
      throw error;
    }
  });

  app.patch('/competitions/:id', async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    const data = parseBody(body, request.body);
    const [competition] = await db.competition.updateManyAndReturn({
      where: { id, team: { userId: user.id } }, data, select,
    });
    if (!competition) return rejectUnavailable(id, user.id);
    return competition;
  });

  app.delete('/competitions/:id', async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    const result = await db.competition.deleteMany({ where: { id, team: { userId: user.id } } });
    if (!result.count) return rejectUnavailable(id, user.id);
    return reply.code(204).send();
  });
}
