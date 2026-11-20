import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildApp } from "../src/app.js";
import { createDatabase } from "../src/database.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const userId = randomUUID();
const teamId = randomUUID();
const otherId = randomUUID();
const ownerId = randomUUID();
const headers = { authorization: `Bearer ${"a".repeat(43)}` };

test("seguir e deixar de seguir são idempotentes, isolados e limpam apenas a seleção sem acesso", async (t) => {
  let exists = true;
  let owner = false;
  let activeTeamId: string | null = null;
  let validSession = true;
  let locked = false;
  const follows = new Set<string>();
  const tx = {
    $queryRaw: async (query: TemplateStringsArray, id: string) => {
      assert.equal(id, teamId);
      assert.match(query.join("?"), /FOR UPDATE/);
      locked = true;
      return exists ? [{ user_id: owner ? userId : ownerId }] : [];
    },
    teamFollow: {
      upsert: async ({ where, create, update }: any) => {
        assert.ok(locked);
        assert.deepEqual(where, { userId_teamId: { userId, teamId } });
        assert.deepEqual(create, { userId, teamId });
        assert.deepEqual(update, {});
        follows.add(userId);
      },
      deleteMany: async ({ where }: any) => {
        assert.ok(locked);
        assert.deepEqual(where, { userId, teamId });
        follows.delete(userId);
      },
    },
    user: {
      updateMany: async ({ where, data }: any) => {
        assert.ok(locked);
        assert.equal(owner, false);
        assert.deepEqual(where, { id: userId, activeTeamId: teamId });
        assert.deepEqual(data, { activeTeamId: null });
        if (activeTeamId === teamId) activeTeamId = null;
      },
    },
  };
  const db = {
    authSession: {
      findUnique: async () => (validSession ? { user: { id: userId } } : null),
    },
    $transaction: async (action: any) => {
      locked = false;
      return action(tx);
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
  const url = `/api/v1/teams/${teamId}/follow`;
  for (const method of ["PUT", "DELETE"] as const) {
    assert.equal((await app.inject({ method, url })).statusCode, 401);
    assert.equal(
      (await app.inject({ method, url: "/api/v1/teams/bad/follow", headers }))
        .statusCode,
      400,
    );
    assert.equal(
      (await app.inject({ method, url: `${url}?userId=${otherId}`, headers }))
        .statusCode,
      400,
    );
    for (const payload of [
      {},
      { userId: otherId },
      { teamId },
      { isFollowing: true },
    ]) {
      assert.equal(
        (await app.inject({ method, url, headers, payload })).statusCode,
        400,
      );
    }
  }
  follows.add(otherId);
  for (let repeat = 0; repeat < 2; repeat++) {
    const result = await app.inject({ method: "PUT", url, headers });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.json(), { teamId, isFollowing: true });
    assert.equal(result.headers["cache-control"], "no-store");
    assert.equal(activeTeamId, null);
  }
  assert.equal(follows.size, 2);
  activeTeamId = otherId;
  assert.equal(
    (await app.inject({ method: "DELETE", url, headers })).statusCode,
    204,
  );
  assert.equal(activeTeamId, otherId);
  activeTeamId = teamId;
  assert.equal(
    (await app.inject({ method: "DELETE", url, headers })).statusCode,
    204,
  );
  assert.equal(activeTeamId, null);
  assert.deepEqual([...follows], [otherId]);
  owner = true;
  activeTeamId = teamId;
  await app.inject({ method: "PUT", url, headers });
  await app.inject({ method: "DELETE", url, headers });
  assert.equal(activeTeamId, teamId);
  assert.deepEqual([...follows], [otherId]);
  exists = false;
  for (const method of ["PUT", "DELETE"] as const)
    assert.equal((await app.inject({ method, url, headers })).statusCode, 404);
  validSession = false;
  assert.equal(
    (await app.inject({ method: "PUT", url, headers })).statusCode,
    401,
  );
});

test("busca expõe metadados, pagina por nome/id e listagem reúne times próprios e seguidos", async (t) => {
  const ids = [randomUUID(), randomUUID(), randomUUID()].sort();
  let lastQuery: any;
  const rows = ids.map((id, index) => ({
    id,
    name: "Ajax",
    sport: "Futsal",
    category: "Sub-11",
    userId: index === 0 ? userId : ownerId,
    followers: index < 2 ? [{ userId }] : [],
    _count: { athletes: 3 },
    matches: [{ startsAt: new Date("2026-12-01T12:00:00Z") }],
  }));
  const db = {
    authSession: { findUnique: async () => ({ user: { id: userId } }) },
    team: {
      findMany: async (query: any) => {
        lastQuery = query;
        return (
          query.where.OR?.[1]?.id
            ? rows.filter((row) => row.id > query.where.OR[1].id.gt)
            : rows
        ).slice(0, query.take);
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
  assert.equal(
    (await app.inject({ url: "/api/v1/teams/search?q=Ajax" })).statusCode,
    401,
  );
  for (const query of [
    "",
    "?q=a",
    "?q=" + "x".repeat(81),
    "?q=Ajax&cursor=bad",
    "?q=Ajax&limit=51",
    "?q=Ajax&userId=x",
  ]) {
    assert.equal(
      (await app.inject({ url: "/api/v1/teams/search" + query, headers }))
        .statusCode,
      400,
    );
  }
  const page = await app.inject({
    url: "/api/v1/teams/search?q=Ajax&limit=2",
    headers,
  });
  assert.equal(page.statusCode, 200, page.body);
  assert.deepEqual(
    Object.keys(page.json().data[0]).sort(),
    ["id", "name", "sport", "category", "isOwner", "isFollowing"].sort(),
  );
  assert.equal(page.json().data[0].isOwner, true);
  assert.equal(page.json().data[0].isFollowing, true);
  assert.deepEqual(lastQuery.orderBy, [{ name: "asc" }, { id: "asc" }]);
  const cursor = page.json().nextCursor;
  assert.deepEqual(JSON.parse(Buffer.from(cursor, "base64url").toString()), [
    "Ajax",
    ids[1],
  ]);
  // A deleted boundary row does not need to be looked up to continue the cursor.
  rows.splice(1, 1);
  const next = await app.inject({
    url: `/api/v1/teams/search?q=Ajax&cursor=${cursor}`,
    headers,
  });
  assert.deepEqual(
    next.json().data.map((row: any) => row.id),
    [ids[2]],
  );
  assert.equal(next.json().nextCursor, null);
  assert.equal(next.json().data[0].isFollowing, false);
  await app.inject({ url: "/api/v1/teams/search?q=%25_", headers });
  assert.deepEqual(lastQuery.where.name, {
    contains: "\\%\\_",
    mode: "insensitive",
  });
  const mine = await app.inject({ url: "/api/v1/teams", headers });
  assert.deepEqual(lastQuery.where.OR, [
    { userId },
    { followers: { some: { userId } } },
  ]);
  assert.equal(mine.json().data[0].athletesCount, 3);
  assert.equal(mine.json().data[0].nextMatchAt, "2026-12-01T12:00:00.000Z");
  assert.equal(mine.json().data[0].followers, undefined);
  assert.equal(mine.json().data[0]._count, undefined);
});

test(
  "PostgreSQL revoga acesso sem excluir jogos e mantém concorrência consistente",
  {
    skip: process.env.TEST_DATABASE_URL
      ? false
      : "Configure TEST_DATABASE_URL com PostgreSQL migrado",
  },
  async (t) => {
    const db = createDatabase(process.env.TEST_DATABASE_URL!);
    const prefix = randomUUID();
    const app = buildApp({
      db,
      sessionTtlHours: 1,
      verifyGoogleIdentity: async (sub) => ({
        sub: prefix + sub,
        email: `${sub}@example.com`,
        name: sub,
      }),
    });
    t.after(async () => {
      await app.close();
      try {
        await db.user.deleteMany({
          where: { googleSub: { startsWith: prefix } },
        });
      } finally {
        await db.$disconnect();
      }
    });
    async function login(idToken: string) {
      const result = await app.inject({
        method: "POST",
        url: "/api/v1/auth/google",
        payload: { idToken },
      });
      assert.equal(result.statusCode, 200);
      return {
        user: result.json().user,
        headers: { authorization: `Bearer ${result.json().sessionToken}` },
      };
    }
    const owner = await login("owner");
    const follower = await login("follower");
    const secondFollower = await login("second");
    const team = await db.team.create({
      data: {
        userId: owner.user.id,
        name: "Ajax",
        sport: "Futsal",
        category: "Sub-11",
      },
    });
    const followUrl = `/api/v1/teams/${team.id}/follow`;
    const matchesUrl = `/api/v1/teams/${team.id}/matches`;
    const detailUrl = `/api/v1/teams/${team.id}`;
    const sendFollow = (
      headers: typeof owner.headers,
      method: "PUT" | "DELETE",
    ) => app.inject({ method, url: followUrl, headers });
    assert.equal(
      (await app.inject({ url: detailUrl, headers: follower.headers }))
        .statusCode,
      404,
    );
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/v1/me",
          headers: follower.headers,
          payload: { activeTeamId: team.id },
        })
      ).statusCode,
      404,
    );
    for (const actor of [follower, secondFollower]) {
      for (let i = 0; i < 2; i++)
        assert.equal((await sendFollow(actor.headers, "PUT")).statusCode, 200);
    }
    assert.equal(await db.teamFollow.count({ where: { teamId: team.id } }), 2);
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: follower.user.id } }))
        .activeTeamId,
      null,
    );
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/v1/me",
          headers: follower.headers,
          payload: { activeTeamId: team.id },
        })
      ).statusCode,
      200,
    );
    const created = await app.inject({
      method: "POST",
      url: matchesUrl,
      headers: follower.headers,
      payload: { opponent: "Rival", startsAt: "2026-12-01T12:00:00Z" },
    });
    assert.equal(created.statusCode, 201, created.body);
    const gameId = created.json().id;
    assert.equal(
      (
        await app.inject({
          url: `/api/v1/matches/${gameId}`,
          headers: secondFollower.headers,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await sendFollow(follower.headers, "DELETE")).statusCode,
      204,
    );
    assert.equal(
      (await sendFollow(follower.headers, "DELETE")).statusCode,
      204,
    );
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: follower.user.id } }))
        .activeTeamId,
      null,
    );
    for (const url of [
      detailUrl,
      matchesUrl,
      `/api/v1/matches/${gameId}`,
      `/api/v1/matches/${gameId}/message?type=sheet`,
    ]) {
      assert.equal(
        (await app.inject({ url, headers: follower.headers })).statusCode,
        404,
      );
    }
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/v1/matches/${gameId}`,
          headers: follower.headers,
          payload: { opponent: "Bloqueado" },
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: `/api/v1/matches/${gameId}/callups`,
          headers: follower.headers,
          payload: { athleteIds: [] },
        })
      ).statusCode,
      404,
    );
    assert.ok(await db.match.findUnique({ where: { id: gameId } }));
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/v1/matches/${gameId}`,
          headers: secondFollower.headers,
          payload: { opponent: "Atualizado" },
        })
      ).statusCode,
      200,
    );
    await sendFollow(owner.headers, "PUT");
    await db.user.update({
      where: { id: owner.user.id },
      data: { activeTeamId: team.id },
    });
    const owned = await app.inject({
      url: "/api/v1/teams",
      headers: owner.headers,
    });
    assert.equal(
      owned.json().data.filter((item: any) => item.id === team.id).length,
      1,
    );
    await sendFollow(owner.headers, "DELETE");
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: owner.user.id } }))
        .activeTeamId,
      team.id,
    );
    assert.equal(
      (await app.inject({ url: detailUrl, headers: owner.headers })).statusCode,
      200,
    );
    await sendFollow(follower.headers, "PUT");
    const race = await Promise.all([
      app.inject({
        method: "PATCH",
        url: "/api/v1/me",
        headers: follower.headers,
        payload: { activeTeamId: team.id },
      }),
      sendFollow(follower.headers, "DELETE"),
      app.inject({
        method: "POST",
        url: matchesUrl,
        headers: follower.headers,
        payload: { opponent: "Concorrente", startsAt: "2026-12-02T12:00:00Z" },
      }),
    ]);
    assert.ok([200, 404].includes(race[0]!.statusCode));
    assert.equal(race[1]!.statusCode, 204);
    assert.ok([201, 404].includes(race[2]!.statusCode));
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: follower.user.id } }))
        .activeTeamId,
      null,
    );
    assert.equal(
      (await app.inject({ url: matchesUrl, headers: follower.headers }))
        .statusCode,
      404,
    );
  },
);
