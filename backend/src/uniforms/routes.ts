import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createAuthService } from "../auth/service.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { ApiError, parseBody } from "../http/errors.js";

const pieceType = z.enum(["shirt", "shorts", "socks"]);
const fields = z.strictObject({
  uniformName: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(80),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  isHomeDefault: z.boolean(),
  isAwayDefault: z.boolean(),
});
const createBody = fields.extend({
  pieceType,
  colorHex: fields.shape.colorHex.default("#000000"),
  isHomeDefault: z.boolean().default(false),
  isAwayDefault: z.boolean().default(false),
});
const patchBody = fields
  .partial()
  .refine((data) => Object.keys(data).length > 0);
const params = z.object({ id: z.uuid() });
const teamParams = z.object({ teamId: z.uuid() });
const query = z.strictObject({
  pieceType: pieceType.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  cursor: z
    .string()
    .max(64)
    .transform((value) => Buffer.from(value, "base64url").toString("utf8"))
    .pipe(z.uuid())
    .optional(),
});
const select = {
  id: true,
  teamId: true,
  pieceType: true,
  uniformName: true,
  description: true,
  colorHex: true,
  isHomeDefault: true,
  isAwayDefault: true,
} as const;
const missing = () =>
  new ApiError(404, "NOT_FOUND", "Peça ou time não encontrado");

export async function uniformRoutes(
  app: FastifyInstance,
  { db, sessionTtlHours }: { db: PrismaClient; sessionTtlHours: number },
) {
  const auth = createAuthService(db, sessionTtlHours);
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  async function lockOwner(
    tx: Prisma.TransactionClient,
    teamId: string,
    userId: string,
  ) {
    const teams = await tx.$queryRaw<{ user_id: string }[]>`
      SELECT user_id FROM teams WHERE id = ${teamId}::uuid FOR UPDATE
    `;
    if (!teams[0]) throw missing();
    if (teams[0].user_id === userId) return;
    const following = await tx.teamFollow.findUnique({
      where: { userId_teamId: { userId, teamId } },
      select: { teamId: true },
    });
    if (!following) throw missing();
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Somente o criador do time pode alterar uniformes",
    );
  }

  async function clearDefaults(
    tx: Prisma.TransactionClient,
    teamId: string,
    type: string,
    data: z.infer<typeof patchBody>,
  ) {
    // The team lock serializes default replacement with other writes and match creation.
    for (const flag of ["isHomeDefault", "isAwayDefault"] as const) {
      if (data[flag] === true) {
        await tx.uniformPiece.updateMany({
          where: { teamId, pieceType: type, [flag]: true },
          data: { [flag]: false },
        });
      }
    }
  }

  app.get("/teams/:teamId/uniforms", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { teamId } = parseBody(teamParams, request.params);
    const { limit, cursor, pieceType } = parseBody(query, request.query);
    const team = await db.team.findUnique({
      where: {
        id: teamId,
        OR: [{ userId: user.id }, { followers: { some: { userId: user.id } } }],
      },
      select: {
        uniformPieces: {
          where: { pieceType, ...(cursor ? { id: { gt: cursor } } : {}) },
          select,
          orderBy: { id: "asc" },
          take: limit + 1,
        },
      },
    });
    if (!team) throw missing();
    const data = team.uniformPieces.slice(0, limit);
    return {
      data,
      nextCursor:
        team.uniformPieces.length > limit
          ? Buffer.from(data.at(-1)!.id).toString("base64url")
          : null,
    };
  });

  app.post("/teams/:teamId/uniforms", async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { teamId } = parseBody(teamParams, request.params);
    const data = parseBody(createBody, request.body);
    const piece = await db.$transaction(async (tx) => {
      await lockOwner(tx, teamId, user.id);
      await clearDefaults(tx, teamId, data.pieceType, data);
      return tx.uniformPiece.create({ data: { ...data, teamId }, select });
    });
    return reply.code(201).send(piece);
  });

  async function mutate<T>(
    id: string,
    userId: string,
    change: (
      tx: Prisma.TransactionClient,
      piece: { teamId: string; pieceType: string },
    ) => Promise<T>,
  ) {
    return db.$transaction(async (tx) => {
      const piece = await tx.uniformPiece.findUnique({
        where: { id },
        select: { teamId: true, pieceType: true },
      });
      if (!piece) throw missing();
      await lockOwner(tx, piece.teamId, userId);
      // Recheck after acquiring the lock in case another request deleted the piece.
      if (
        !(await tx.uniformPiece.findUnique({
          where: { id },
          select: { id: true },
        }))
      )
        throw missing();
      return change(tx, piece);
    });
  }

  app.patch("/uniforms/:id", async (request) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    const data = parseBody(patchBody, request.body);
    return mutate(id, user.id, async (tx, piece) => {
      await clearDefaults(tx, piece.teamId, piece.pieceType, data);
      return tx.uniformPiece.update({ where: { id }, data, select });
    });
  });

  app.delete("/uniforms/:id", async (request, reply) => {
    const { user } = await auth.requireSession(request.headers.authorization);
    const { id } = parseBody(params, request.params);
    await mutate(id, user.id, (tx) =>
      tx.uniformPiece.delete({ where: { id } }),
    );
    return reply.code(204).send();
  });
}
