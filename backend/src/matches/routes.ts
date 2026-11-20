import { Temporal } from "@js-temporal/polyfill";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createAuthService } from "../auth/service.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { ApiError, parseBody } from "../http/errors.js";

import { buildMatchMessage, messageSelect } from "./message.js";

const messageQuery = z.strictObject({
  type: z.enum(["sheet", "callup"]).default("callup"),
});
const teamParams = z.object({ teamId: z.uuid() });
const matchParams = z.object({ id: z.uuid() });
const pageLimit = z.coerce.number().int().min(1).max(50).default(50);
const day = z.iso.date().refine((value) => !value.startsWith("0000"));
const instant = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value));
const cursorData = z.tuple([instant, z.uuid()]);
const matchCursor = z
  .string()
  .max(160)
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
  .pipe(cursorData);
const listQuery = z
  .strictObject({
    from: day.optional(),
    to: day.optional(),
    upcoming: z.enum(["true", "false"]).optional(),
    limit: pageLimit,
    cursor: matchCursor.optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    path: ["to"],
    message: "A data final deve ser igual ou posterior à inicial",
  });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullish();
const matchBody = z.strictObject({
  opponent: z.string().trim().min(1).max(120),
  startsAt: instant,
  isHome: z.boolean().optional(),
  location: optionalText(200),
  notes: optionalText(2000),
  competitionId: z.uuid().nullish(),
  shirtPieceId: z.uuid().nullish(),
  shortsPieceId: z.uuid().nullish(),
  socksPieceId: z.uuid().nullish(),
  refereeFeeCents: z.number().int().min(0).max(2147483647).nullish(),
});

const callupBody = z.strictObject({
  athleteIds: z
    .array(z.uuid().transform((id) => id.toLowerCase()))
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Não repita atletas na convocação",
    ),
});

const pieceFields = [
  ["shirtPieceId", "shirt"],
  ["shortsPieceId", "shorts"],
  ["socksPieceId", "socks"],
] as const;
const pieceSelect = {
  id: true,
  pieceType: true,
  uniformName: true,
  description: true,
  colorHex: true,
  isHomeDefault: true,
  isAwayDefault: true,
} as const;
const matchInclude = {
  competition: { select: { id: true, name: true } },
  shirtPiece: { select: pieceSelect },
  shortsPiece: { select: pieceSelect },
  socksPiece: { select: pieceSelect },
  _count: { select: { callups: true } },
} as const;
const detailInclude = {
  ...matchInclude,
  callups: {
    orderBy: { athlete: { shirtNumber: "asc" } },
    select: {
      athleteId: true,
      athlete: {
        select: { name: true, shirtNumber: true, position: true, status: true },
      },
    },
  },
} satisfies Prisma.MatchInclude;

function serializeMatch({
  _count,
  hasSavedCallup: _hasSavedCallup,
  ...match
}: Prisma.MatchGetPayload<{ include: typeof matchInclude }>) {
  return {
    ...match,
    arrivalAt: new Date(match.startsAt.getTime() - 60 * 60 * 1000),
    callupsCount: _count.callups,
  };
}

function serializeCallups(
  match: Prisma.MatchGetPayload<{ include: typeof detailInclude }>,
) {
  return {
    hasSavedCallup: match.hasSavedCallup,
    callups: match.callups.map(
      ({ athleteId, athlete: { status: _status, ...athlete } }) => ({
        athleteId,
        ...athlete,
      }),
    ),
    warnings: match.callups
      .filter(({ athlete }) => athlete.status !== "active")
      .map(({ athleteId }) => ({ athleteId, code: "ATHLETE_UNAVAILABLE" })),
    estimatedRefereeTotalCents:
      match.refereeFeeCents === null
        ? null
        : match.refereeFeeCents * match.callups.length,
  };
}

function teamAccess(userId: string): Pick<Prisma.TeamWhereInput, "OR"> {
  return { OR: [{ userId }, { followers: { some: { userId } } }] };
}

const missingTeam = () => new ApiError(404, "NOT_FOUND", "Time não encontrado");
const missingMatch = () =>
  new ApiError(404, "NOT_FOUND", "Jogo não encontrado");

function startOfDay(date: Temporal.PlainDate, timezone: string) {
  return new Date(date.toZonedDateTime(timezone).epochMilliseconds);
}

function matchRange(
  { from, to, upcoming }: z.infer<typeof listQuery>,
  timezone: string,
) {
  const lower = from
    ? startOfDay(Temporal.PlainDate.from(from), timezone)
    : undefined;
  const upper = to
    ? startOfDay(Temporal.PlainDate.from(to).add({ days: 1 }), timezone)
    : undefined;
  const now = new Date();
  const gte = upcoming === "true" && (!lower || lower < now) ? now : lower;
  return { gte, lt: upper };
}

async function lockAccessibleTeam(
  tx: Prisma.TransactionClient,
  teamId: string,
  userId: string,
) {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM teams WHERE id = ${teamId}::uuid FOR UPDATE
  `;
  return (
    locked.length > 0 &&
    Boolean(
      await tx.team.findUnique({
        where: { id: teamId, ...teamAccess(userId) },
        select: { id: true },
      }),
    )
  );
}

function invalidReference(field: string) {
  return new ApiError(422, "VALIDATION_ERROR", "Referência inválida", {
    [field]: "Selecione um item válido deste time",
  });
}

async function matchReferences(
  tx: Prisma.TransactionClient,
  teamId: string,
  input: Partial<z.infer<typeof matchBody>>,
  applyDefaults: boolean,
) {
  const { competitionId } = input;
  if (
    competitionId &&
    !(await tx.competition.findUnique({
      where: { id: competitionId, teamId },
      select: { id: true },
    }))
  )
    throw invalidReference("competitionId");

  const ids = pieceFields.flatMap(([field]) =>
    input[field] ? [input[field]] : [],
  );
  const defaultFilter =
    input.isHome === false ? { isAwayDefault: true } : { isHomeDefault: true };
  const useDefaults =
    applyDefaults && pieceFields.some(([field]) => input[field] === undefined);
  const choices =
    useDefaults || ids.length
      ? await tx.uniformPiece.findMany({
          where: {
            teamId,
            OR: [{ id: { in: ids } }, ...(useDefaults ? [defaultFilter] : [])],
          },
          select: {
            id: true,
            pieceType: true,
            isHomeDefault: true,
            isAwayDefault: true,
          },
        })
      : [];

  const pieces: Pick<
    Partial<z.infer<typeof matchBody>>,
    (typeof pieceFields)[number][0]
  > = {};
  for (const [field, type] of pieceFields) {
    const id = input[field];
    if (
      id &&
      !choices.some((piece) => piece.id === id && piece.pieceType === type)
    ) {
      throw invalidReference(field);
    }
    if (id !== undefined) pieces[field] = id;
    else if (useDefaults) {
      pieces[field] =
        choices.find(
          (piece) =>
            piece.pieceType === type &&
            (input.isHome === false
              ? piece.isAwayDefault
              : piece.isHomeDefault),
        )?.id ?? null;
    }
  }
  return pieces;
}

export async function matchRoutes(
  app: FastifyInstance,
  { db, sessionTtlHours }: { db: PrismaClient; sessionTtlHours: number },
) {
  const auth = createAuthService(db, sessionTtlHours);
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  app.get("/teams/:teamId/matches", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { teamId } = parseBody(teamParams, request.params);
    const query = parseBody(listQuery, request.query);
    const { limit, cursor } = query;
    const team = await db.team.findUnique({
      where: { id: teamId, ...teamAccess(user.id) },
      select: {
        matches: {
          where: {
            startsAt: matchRange(query, user.timezone),
            ...(cursor && {
              OR: [
                { startsAt: { gt: cursor[0] } },
                { startsAt: cursor[0], id: { gt: cursor[1] } },
              ],
            }),
          },
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
          take: limit + 1,
          include: matchInclude,
        },
      },
    });
    if (!team) throw missingTeam();
    const data = team.matches.slice(0, limit).map(serializeMatch);
    const last = data.at(-1);
    return {
      data,
      nextCursor:
        last && team.matches.length > limit
          ? Buffer.from(JSON.stringify([last.startsAt, last.id])).toString(
              "base64url",
            )
          : null,
    };
  });

  app.get("/matches/:id/message", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(matchParams, request.params);
    const { type } = parseBody(messageQuery, request.query);
    const match = await db.match.findUnique({
      where: { id, team: teamAccess(user.id) },
      select: messageSelect,
    });
    if (!match) throw missingMatch();
    return buildMatchMessage(match, user.timezone, type);
  });

  app.get("/matches/:id", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(matchParams, request.params);
    const match = await db.match.findUnique({
      where: { id, team: teamAccess(user.id) },
      include: detailInclude,
    });
    if (!match) throw missingMatch();
    const { callups: _callups, hasSavedCallup, ...record } = match;
    return {
      ...serializeMatch({ ...record, hasSavedCallup }),
      ...serializeCallups(match),
    };
  });

  app.post("/teams/:teamId/matches", async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { teamId } = parseBody(teamParams, request.params);
    const input = parseBody(matchBody, request.body);
    const match = await db.$transaction(async (tx) => {
      if (!(await lockAccessibleTeam(tx, teamId, user.id))) throw missingTeam();
      const pieces = await matchReferences(tx, teamId, input, true);
      return tx.match.create({
        data: { ...input, ...pieces, teamId },
        include: matchInclude,
      });
    });
    return reply.code(201).send(serializeMatch(match));
  });

  async function mutateMatch<T>(
    id: string,
    userId: string,
    mutate: (tx: Prisma.TransactionClient, teamId: string) => Promise<T>,
  ) {
    return db.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id, team: teamAccess(userId) },
        select: { teamId: true },
      });
      if (!match || !(await lockAccessibleTeam(tx, match.teamId, userId)))
        throw missingMatch();
      try {
        return await mutate(tx, match.teamId);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          throw missingMatch();
        }
        throw error;
      }
    });
  }

  app.put("/matches/:id/callups", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(matchParams, request.params);
    const { athleteIds } = parseBody(callupBody, request.body);
    const match = await mutateMatch(id, user.id, async (tx, teamId) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM matches WHERE id = ${id}::uuid FOR UPDATE
      `;
      if (!locked.length) throw missingMatch();

      if (athleteIds.length) {
        // Protect roster references from concurrent deletion or changes until commit.
        await tx.$queryRaw`
          SELECT id FROM athletes
          WHERE team_id = ${teamId}::uuid
            AND id IN (${Prisma.join(athleteIds.map((athleteId) => Prisma.sql`${athleteId}::uuid`))})
          ORDER BY id FOR SHARE
        `;
        const athletes = await tx.athlete.findMany({
          where: { id: { in: athleteIds }, team: teamAccess(user.id) },
          select: { id: true, teamId: true },
        });
        if (athletes.length !== athleteIds.length)
          throw new ApiError(404, "NOT_FOUND", "Atleta não encontrado");
        if (athletes.some((athlete) => athlete.teamId !== teamId))
          throw invalidReference("athleteIds");
      }

      return tx.match.update({
        where: { id },
        data: {
          hasSavedCallup: true,
          callups: {
            deleteMany: {},
            create: athleteIds.map((athleteId) => ({ athleteId })),
          },
        },
        include: detailInclude,
      });
    });
    return {
      matchId: match.id,
      ...serializeCallups(match),
      count: match.callups.length,
    };
  });

  app.patch("/matches/:id", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(matchParams, request.params);
    const input = parseBody(matchBody.partial(), request.body);
    const match = await mutateMatch(id, user.id, async (tx, teamId) => {
      const pieces = await matchReferences(tx, teamId, input, false);
      return tx.match.update({
        where: { id },
        data: { ...input, ...pieces },
        include: matchInclude,
      });
    });
    return serializeMatch(match);
  });

  app.delete("/matches/:id", async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(matchParams, request.params);
    await mutateMatch(id, user.id, (tx) => tx.match.delete({ where: { id } }));
    return reply.code(204).send();
  });
}
