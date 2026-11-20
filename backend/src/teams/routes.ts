import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createAuthService } from "../auth/service.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { ApiError, parseBody } from "../http/errors.js";

const teamBody = z.strictObject({
  name: z.string().trim().min(1).max(100),
  sport: z.string().trim().min(1).max(60),
  category: z.string().trim().min(1).max(60),
});
const updateBody = teamBody
  .partial()
  .refine((data) => Object.keys(data).length > 0);
const params = z.object({ id: z.uuid() });
const select = {
  id: true,
  name: true,
  sport: true,
  category: true,
  createdAt: true,
} as const;
const searchQuery = z.strictObject({
  q: z.string().trim().max(100).default(""),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  mine: z.enum(["true", "false"]).default("true"),
});

const discoveryQuery = z.strictObject({
  q: z.string().trim().min(2).max(80),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  cursor: z
    .string()
    .max(1024)
    .transform((value, ctx) => {
      try {
        return JSON.parse(
          Buffer.from(value, "base64url").toString("utf8"),
        ) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Cursor inválido" });
        return z.NEVER;
      }
    })
    .pipe(z.tuple([z.string().min(1), z.uuid()]))
    .optional(),
});
const emptyBody = z.undefined();
const emptyQuery = z.strictObject({});

export async function teamRoutes(
  app: FastifyInstance,
  options: { db: PrismaClient; sessionTtlHours: number },
) {
  const { db } = options;
  const auth = createAuthService(db, options.sessionTtlHours);
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  app.get("/me/teams", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    return db.team.findMany({
      where: { userId: user.id },
      select,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });

  app.get("/teams", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { q, cursor, limit, mine } = parseBody(searchQuery, request.query);
    // Escape LIKE wildcards so the search treats the user's text literally.
    const name = q.replace(/[\\%_]/g, "\\$&");
    const rows = await db.team.findMany({
      where: {
        name: { contains: name, mode: "insensitive" },
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(mine === "true"
          ? {
              OR: [
                { userId: user.id },
                { followers: { some: { userId: user.id } } },
              ],
            }
          : {}),
      },
      select: {
        ...select,
        userId: true,
        followers: { where: { userId: user.id }, select: { userId: true } },
        ...(mine === "true"
          ? {
              _count: { select: { athletes: true } },
              matches: {
                where: { startsAt: { gte: new Date() } },
                orderBy: [{ startsAt: "asc" as const }, { id: "asc" as const }],
                take: 1,
                select: { startsAt: true },
              },
            }
          : {}),
      },
      orderBy: { id: "asc" },
      take: limit + 1,
    });
    const data = rows
      .slice(0, limit)
      .map(({ userId, followers, _count, matches, ...team }) => ({
        ...team,
        isOwner: userId === user.id,
        isFollowing: followers?.length > 0,
        ...(mine === "true"
          ? {
              athletesCount: _count?.athletes ?? 0,
              nextMatchAt: matches?.[0]?.startsAt ?? null,
            }
          : {}),
      }));
    return { data, nextCursor: rows.length > limit ? data.at(-1)!.id : null };
  });

  app.get("/teams/search", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { q, limit, cursor } = parseBody(discoveryQuery, request.query);
    const name = q.replace(/[\\%_]/g, "\\$&");
    const rows = await db.team.findMany({
      where: {
        name: { contains: name, mode: "insensitive" },
        ...(cursor
          ? {
              OR: [
                { name: { gt: cursor[0] } },
                { name: cursor[0], id: { gt: cursor[1] } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        sport: true,
        category: true,
        userId: true,
        followers: { where: { userId: user.id }, select: { userId: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit + 1,
    });
    const data = rows
      .slice(0, limit)
      .map(({ id, name, sport, category, userId, followers }) => ({
        id,
        name,
        sport,
        category,
        isOwner: userId === user.id,
        isFollowing: followers.length > 0,
      }));
    const last = data.at(-1);
    return {
      data,
      nextCursor:
        last && rows.length > limit
          ? Buffer.from(JSON.stringify([last.name, last.id])).toString(
              "base64url",
            )
          : null,
    };
  });

  async function changeFollow(
    teamId: string,
    userId: string,
    following: boolean,
  ) {
    return db.$transaction(async (tx) => {
      // Use the same team lock as match, callup and active-team mutations.
      const teams = await tx.$queryRaw<{ user_id: string }[]>`
        SELECT user_id FROM teams WHERE id = ${teamId}::uuid FOR UPDATE
      `;
      if (!teams[0])
        throw new ApiError(404, "NOT_FOUND", "Time não encontrado");
      if (following) {
        await tx.teamFollow.upsert({
          where: { userId_teamId: { userId, teamId } },
          create: { userId, teamId },
          update: {},
        });
      } else {
        await tx.teamFollow.deleteMany({ where: { userId, teamId } });
        if (teams[0].user_id !== userId) {
          await tx.user.updateMany({
            where: { id: userId, activeTeamId: teamId },
            data: { activeTeamId: null },
          });
        }
      }
    });
  }

  app.put("/teams/:id/follow", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    parseBody(emptyBody, request.body);
    parseBody(emptyQuery, request.query);
    await changeFollow(id, user.id, true);
    return { teamId: id, isFollowing: true };
  });

  app.delete("/teams/:id/follow", async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    parseBody(emptyBody, request.body);
    parseBody(emptyQuery, request.query);
    await changeFollow(id, user.id, false);
    return reply.code(204).send();
  });

  app.get("/teams/:id", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    const team = await db.team.findUnique({
      where: {
        id,
        OR: [{ userId: user.id }, { followers: { some: { userId: user.id } } }],
      },
      select: { ...select, userId: true },
    });
    if (!team) throw new ApiError(404, "NOT_FOUND", "Time não encontrado");
    const { userId, ...details } = team;
    return { ...details, isOwner: userId === user.id };
  });

  app.post("/teams/:id/select", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    return auth.updateProfile(user.id, { activeTeamId: id });
  });

  app.post("/teams", async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const data = parseBody(teamBody, request.body);
    const team = await db.team.create({
      data: { ...data, userId: user.id },
      select,
    });
    return reply.code(201).send(team);
  });

  app.patch("/teams/:id", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    const data = parseBody(updateBody, request.body);
    // Ownership is part of the mutation itself, avoiding a check/write race.
    const teams = await db.team.updateManyAndReturn({
      where: { id, userId: user.id },
      data,
      select,
    });
    if (!teams[0]) throw new ApiError(404, "NOT_FOUND", "Time não encontrado");
    return teams[0];
  });

  app.delete("/teams/:id", async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    const result = await db.team.deleteMany({ where: { id, userId: user.id } });
    if (!result.count)
      throw new ApiError(404, "NOT_FOUND", "Time não encontrado");
    return reply.code(204).send();
  });
}
