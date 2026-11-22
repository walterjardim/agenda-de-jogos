import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../src/app.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const userId = "00000000-0000-4000-8000-000000000001";
const teamId = "00000000-0000-4000-8000-000000000010";
const firstId = "00000000-0000-4000-8000-000000000101";
const secondId = "00000000-0000-4000-8000-000000000102";
const startsAt = new Date("2026-11-19T03:20:00.000Z");

test("agenda filtra o dia no fuso do perfil, pagina empates e exige vínculo", async (t) => {
  let timezone = "America/Sao_Paulo";
  let accessible = true;
  let bounds = {
    gte: new Date("2026-11-19T03:00:00.000Z"),
    lt: new Date("2026-11-20T03:00:00.000Z"),
  };
  const records = [firstId, secondId].map((id) => ({
    id,
    teamId,
    startsAt,
    _count: { callups: 0 },
  }));
  const db = {
    authSession: {
      findUnique: async () => ({ user: { id: userId, timezone } }),
    },
    team: {
      findUnique: async (args: {
        where: unknown;
        select: {
          matches: {
            where: { startsAt: unknown; OR?: unknown };
            orderBy: unknown;
            take: number;
          };
        };
      }) => {
        assert.deepEqual(args.where, {
          id: teamId,
          OR: [{ userId }, { followers: { some: { userId } } }],
        });
        const { where, orderBy, take } = args.select.matches;
        assert.deepEqual(where.startsAt, bounds);
        assert.deepEqual(orderBy, [{ startsAt: "asc" }, { id: "asc" }]);
        assert.equal(take, 2);
        if (!accessible) return null;
        if (where.OR) {
          assert.deepEqual(where.OR, [
            { startsAt: { gt: startsAt } },
            { startsAt, id: { gt: firstId } },
          ]);
          return { matches: records.slice(1) };
        }
        return { matches: records };
      },
    },
  };
  const app = buildApp({
    db: db as unknown as PrismaClient,
    sessionTtlHours: 1,
    verifyGoogleIdentity: async () => {
      throw new Error("unused");
    },
  });
  t.after(() => app.close());
  const path = `/api/v1/teams/${teamId}/matches`;
  const url = `${path}?from=2026-11-19&to=2026-11-19&limit=1`;
  const headers = { authorization: `Bearer ${"a".repeat(43)}` };
  assert.equal((await app.inject({ url })).statusCode, 401);
  assert.equal(
    (await app.inject({ url: `${path}?from=2026-02-30`, headers })).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        url: `${path}?from=2026-11-20&to=2026-11-19`,
        headers,
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (await app.inject({ url: `${url}&cursor=bad`, headers })).statusCode,
    400,
  );
  const first = await app.inject({ url, headers });
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers["cache-control"], "no-store");
  const { data, nextCursor } = first.json();
  assert.deepEqual(
    data.map(({ id }: { id: string }) => id),
    [firstId],
  );
  assert.equal(data[0].arrivalAt, "2026-11-19T02:20:00.000Z");
  const second = await app.inject({
    url: `${url}&cursor=${nextCursor}`,
    headers,
  });
  assert.equal(second.json().data[0].id, secondId);
  assert.equal(second.json().nextCursor, null);

  accessible = false;
  assert.equal((await app.inject({ url, headers })).statusCode, 404);

  timezone = "America/New_York";
  bounds = {
    gte: new Date("2026-03-08T05:00:00.000Z"),
    lt: new Date("2026-03-09T04:00:00.000Z"),
  };
  accessible = true;
  const dst = await app.inject({
    url: `${path}?from=2026-03-08&to=2026-03-08&limit=1`,
    headers,
  });
  assert.equal(dst.statusCode, 200);
});

test("repetir um cadastro devolve a mesma partida enquanto o usuário tem acesso", async (t) => {
  let accessible = true;
  let insertions = 0;
  const stored = new Map<string, { id: string; startsAt: Date; _count: { callups: number } }>();
  const db = {
    authSession: { findUnique: async () => ({ user: { id: userId } }) },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
      $queryRaw: async () => [{ id: teamId }],
      team: { findUnique: async () => accessible ? { id: teamId } : null },
      match: {
        findFirst: async ({ where }: { where: { teamId: string; createKey: string } }) => {
          assert.equal(where.teamId, teamId);
          return stored.get(where.createKey);
        },
        create: async ({ data }: { data: { startsAt: Date; createKey: string } }) => {
          const match = { ...data, id: ++insertions === 1 ? firstId : secondId, _count: { callups: 0 } };
          stored.set(data.createKey, match);
          return match;
        },
      },
    }),
  };
  const app = buildApp({
    db: db as unknown as PrismaClient,
    sessionTtlHours: 1,
    verifyGoogleIdentity: async () => { throw new Error("unused"); },
  });
  t.after(() => app.close());

  const create = (requestId: string) => app.inject({
    method: "POST",
    url: `/api/v1/teams/${teamId}/matches`,
    headers: { authorization: `Bearer ${"a".repeat(43)}` },
    payload: {
      requestId,
      opponent: "Adversário",
      startsAt: startsAt.toISOString(),
      shirtPieceId: null,
      shortsPieceId: null,
      socksPieceId: null,
    },
  });

  const initial = await create("first-attempt");
  assert.equal(initial.statusCode, 201);
  assert.equal(initial.json().id, firstId);
  assert.ok(!("createKey" in initial.json()));

  const retry = await create("first-attempt");
  assert.equal(retry.statusCode, 201);
  assert.equal(retry.json().id, firstId);

  const anotherMatch = await create("another-attempt");
  assert.equal(anotherMatch.statusCode, 201);
  assert.equal(anotherMatch.json().id, secondId);
  assert.equal(insertions, 2);

  accessible = false;
  assert.equal((await create("first-attempt")).statusCode, 404);
});
