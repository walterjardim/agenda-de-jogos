import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createAuthService } from '../auth/service.js';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { ApiError, parseBody } from '../http/errors.js';

const status = z.enum(['active', 'injured', 'suspended']);
const shirtNumber = z.number().int().min(0).max(999);
const athleteBody = z.strictObject({
  name: z.string().trim().min(1).max(80),
  position: z.string().trim().min(1),
  shirtNumber,
  status,
});
const createBody = athleteBody.extend({ status: status.default('active') });
const updateBody = athleteBody.partial().refine((data) => Object.keys(data).length > 0);
const teamParams = z.object({ teamId: z.uuid() });
const athleteParams = z.object({ id: z.uuid() });
const rosterCursor = z.string().regex(/^[A-Za-z0-9_-]{2,4}$/).transform((value) => {
  const decoded = Buffer.from(value, 'base64url');
  const number = Number(decoded.toString());
  return encodeCursor(number) === value ? number : NaN;
}).pipe(shirtNumber);
const listQuery = z.strictObject({
  cursor: rosterCursor.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  q: z.string().trim().optional(),
  status: status.optional(),
});
const select = { id: true, teamId: true, name: true, position: true, shirtNumber: true, status: true } as const;

function encodeCursor(number: number) {
  return Buffer.from(String(number)).toString('base64url');
}

function forbidden() {
  return new ApiError(403, 'FORBIDDEN', 'Somente o criador do time pode alterar o elenco');
}

function teamNotFound() {
  return new ApiError(404, 'NOT_FOUND', 'Time não encontrado');
}

function athleteNotFound() {
  return new ApiError(404, 'NOT_FOUND', 'Atleta não encontrado');
}

function handleWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ApiError(409, 'CONFLICT', 'Esse número de camisa já está em uso no time.', {
      shirtNumber: 'já está em uso',
    });
  }
  throw error;
}

export async function athleteRoutes(
  app: FastifyInstance,
  options: { db: PrismaClient; sessionTtlHours: number },
) {
  const { db } = options;
  const auth = createAuthService(db, options.sessionTtlHours);

  async function rejectUnavailableAthlete(id: string, userId: string): Promise<never> {
    const visible = await db.athlete.findUnique({
      where: { id, team: { followers: { some: { userId } }, userId: { not: userId } } },
      select: { id: true },
    });
    throw visible ? forbidden() : athleteNotFound();
  }

  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
  });

  app.get('/teams/:teamId/athletes', async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { teamId } = parseBody(teamParams, request.params);
    const { cursor, limit, q, status } = parseBody(listQuery, request.query);
    const name = q?.replace(/[\\%_]/g, '\\$&');
    const team = await db.team.findUnique({
      where: {
        id: teamId,
        userId: user.id,
      },
      select: {
        athletes: {
          where: {
            status,
            ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
            ...(cursor !== undefined ? { shirtNumber: { gt: cursor } } : {}),
          },
          select,
          orderBy: { shirtNumber: 'asc' },
          take: limit + 1,
        },
      },
    });
    if (!team) throw teamNotFound();
    const data = team.athletes.slice(0, limit);
    return {
      data,
      nextCursor: team.athletes.length > limit ? encodeCursor(data.at(-1)!.shirtNumber) : null,
    };
  });

  app.post('/teams/:teamId/athletes', async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { teamId } = parseBody(teamParams, request.params);
    const data = parseBody(createBody, request.body);
    try {
      const athlete = await db.athlete.create({
        data: { ...data, team: { connect: { id: teamId, userId: user.id } } },
        select,
      });
      return reply.code(201).send(athlete);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2025', 'P2018', 'P2003'].includes(error.code)
      ) {
        const followed = await db.teamFollow.findUnique({
          where: { userId_teamId: { userId: user.id, teamId } },
          select: { teamId: true },
        });
        throw followed ? forbidden() : teamNotFound();
      }
      handleWriteError(error);
    }
  });

  app.patch('/athletes/:id', async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(athleteParams, request.params);
    const data = parseBody(updateBody, request.body);
    const [athlete] = await db.athlete.updateManyAndReturn({
      where: { id, team: { userId: user.id } },
      data,
      select,
    }).catch(handleWriteError);
    if (!athlete) return rejectUnavailableAthlete(id, user.id);
    return athlete;
  });

  app.delete('/athletes/:id', async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(athleteParams, request.params);
    const result = await db.athlete.deleteMany({ where: { id, team: { userId: user.id } } });
    if (!result.count) return rejectUnavailableAthlete(id, user.id);
    return reply.code(204).send();
  });
}
