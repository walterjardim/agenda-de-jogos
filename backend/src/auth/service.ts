import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';
import { ApiError } from '../http/errors.js';
import type { GoogleIdentity } from './google.js';

export const publicProfile = {
  id: true,
  name: true,
  email: true,
  timezone: true,
  activeTeamId: true,
} as const;

type ProfileUpdate = { timezone?: string; activeTeamId?: string };

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function unauthorized() {
  return new ApiError(401, 'UNAUTHORIZED', 'Sessão inválida ou expirada');
}

export function createAuthService(db: PrismaClient, sessionTtlHours: number) {
  return {
    async login({ sub, email, name }: GoogleIdentity, ttlHours = sessionTtlHours) {
      const sessionToken = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

      const user = await db.$transaction(async (tx) => {
        const profile = await tx.user.upsert({
          where: { googleSub: sub },
          create: { googleSub: sub, email, name },
          update: { email, name },
          select: publicProfile,
        });

        await tx.authSession.create({
          data: { userId: profile.id, tokenHash: hashToken(sessionToken), expiresAt },
        });

        return profile;
      });

      return { user, sessionToken, expiresAt: expiresAt.toISOString() };
    },

    async requireSession(authorization: string | undefined) {
      const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/i)?.[1];
      if (!token) {
        throw unauthorized();
      }

      const session = await db.authSession.findUnique({
        where: {
          tokenHash: hashToken(token),
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, expiresAt: true, user: { select: publicProfile } },
      });
      if (!session) {
        throw unauthorized();
      }
      return session;
    },

    async logout(sessionId: string) {
      await db.authSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    async updateProfile(userId: string, data: ProfileUpdate) {
      return db.$transaction(async (tx) => {
        if (data.activeTeamId !== undefined) {
          const teamId = data.activeTeamId;
          const lockedTeams = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM teams WHERE id = ${teamId}::uuid FOR UPDATE
          `;
          const accessibleTeam =
            lockedTeams.length > 0 &&
            (await tx.team.findFirst({
              where: {
                id: teamId,
                OR: [{ userId }, { followers: { some: { userId } } }],
              },
              select: { id: true },
            }));

          if (!accessibleTeam) {
            throw new ApiError(404, 'NOT_FOUND', 'Time não encontrado');
          }
        }

        return tx.user.update({ where: { id: userId }, data, select: publicProfile });
      });
    },
  };
}
