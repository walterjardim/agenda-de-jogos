import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildApp } from "../src/app.js";
import { createDatabase } from "../src/database.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const userId = randomUUID();
const teamId = randomUUID();
const matchId = randomUUID();
const firstId = randomUUID();
const secondId = randomUUID();
const hiddenId = randomUUID();
const foreignId = randomUUID();
const foreignTeamId = randomUUID();
const roster = [
  {
    id: firstId,
    teamId,
    name: "João",
    shirtNumber: 9,
    position: "Atacante",
    status: "active",
  },
  {
    id: secondId,
    teamId,
    name: "Pedro",
    shirtNumber: 1,
    position: "Goleiro",
    status: "injured",
  },
  {
    id: foreignId,
    teamId: foreignTeamId,
    name: "Outro",
    shirtNumber: 2,
    position: "Goleiro",
    status: "active",
  },
];

test("salva convocações, valida acesso e preserva seleção em entradas inválidas", async (t) => {
  let accessible = true;
  let selected: string[] = [];
  let hasSavedCallup = false;
  let fee: number | null = 1500;
  let teamLocked = false;
  let matchLocked = false;
  let rosterLocked = false;
  let writes = 0;
  let failWrite = false;
  const headers = { authorization: `Bearer ${"a".repeat(43)}` };
  function record() {
    const callups = selected
      .map((athleteId) => ({
        athleteId,
        athlete: roster.find(({ id }) => id === athleteId)!,
      }))
      .sort((a, b) => a.athlete.shirtNumber - b.athlete.shirtNumber)
      .map(
        ({ athleteId, athlete: { id: _id, teamId: _teamId, ...athlete } }) => ({
          athleteId,
          athlete,
        }),
      );
    return {
      id: matchId,
      teamId,
      startsAt: new Date(),
      hasSavedCallup,
      refereeFeeCents: fee,
      callups,
      _count: { callups: callups.length },
    };
  }
  const tx = {
    $queryRaw: async (query: TemplateStringsArray) => {
      const sql = query.join("?");
      if (sql.includes("FROM teams")) teamLocked = true;
      if (sql.includes("FROM matches")) {
        assert.ok(teamLocked);
        matchLocked = true;
      }
      if (sql.includes("FROM athletes")) {
        assert.ok(matchLocked);
        rosterLocked = true;
      }
      return [{ id: matchId }];
    },
    team: { findUnique: async () => (accessible ? { id: teamId } : null) },
    athlete: {
      findMany: async ({ where }: any) => {
        assert.ok(rosterLocked);
        assert.deepEqual(where.team.OR, [
          { userId },
          { followers: { some: { userId } } },
        ]);
        return roster.filter(({ id }) => where.id.in.includes(id));
      },
    },
    match: {
      findUnique: async ({ select }: any) =>
        accessible ? (select ? { teamId } : record()) : null,
      update: async ({ data }: any) => {
        assert.ok(matchLocked);
        assert.deepEqual(data.callups.deleteMany, {});
        assert.equal(data.hasSavedCallup, true);
        if (failWrite) throw new Error("Falha simulada");
        writes++;
        selected = data.callups.create.map(({ athleteId }: any) => athleteId);
        hasSavedCallup = true;
        return record();
      },
    },
  };
  const db = {
    ...tx,
    authSession: { findUnique: async () => ({ user: { id: userId } }) },
    $transaction: async (action: any) => {
      teamLocked = matchLocked = rosterLocked = false;
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
  const url = `/api/v1/matches/${matchId}/callups`;
  async function save(athleteIds: string[]) {
    return app.inject({ method: "PUT", url, headers, payload: { athleteIds } });
  }
  assert.equal(
    (await app.inject({ method: "PUT", url, payload: { athleteIds: [] } }))
      .statusCode,
    401,
  );
  for (const payload of [
    {},
    { athleteIds: null },
    { athleteIds: ["bad"] },
    { athleteIds: [firstId, firstId] },
    { athleteIds: [firstId, firstId.toUpperCase()] },
    { athleteIds: [], userId },
    { athleteIds: [firstId], status: "starter" },
  ]) {
    assert.equal(
      (await app.inject({ method: "PUT", url, headers, payload })).statusCode,
      400,
    );
  }
  assert.equal(writes, 0);
  const response = await save([firstId, secondId]);
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.deepEqual(response.json(), {
    matchId,
    hasSavedCallup: true,
    callups: [
      {
        athleteId: secondId,
        name: "Pedro",
        shirtNumber: 1,
        position: "Goleiro",
      },
      {
        athleteId: firstId,
        name: "João",
        shirtNumber: 9,
        position: "Atacante",
      },
    ],
    count: 2,
    estimatedRefereeTotalCents: 3000,
    warnings: [{ athleteId: secondId, code: "ATHLETE_UNAVAILABLE" }],
  });
  assert.deepEqual((await save([firstId, secondId])).json(), response.json());
  const before = [...selected];
  assert.equal((await save([firstId, hiddenId])).statusCode, 404);
  assert.equal((await save([foreignId])).statusCode, 422);
  assert.equal((await save([foreignId, hiddenId])).statusCode, 404);
  assert.deepEqual(selected, before);
  accessible = false;
  assert.equal((await save([])).statusCode, 404);
  assert.deepEqual(selected, before);
  accessible = true;
  failWrite = true;
  assert.equal((await save([])).statusCode, 500);
  assert.deepEqual(selected, before);
  failWrite = false;
  fee = 0;
  assert.equal((await save([firstId])).json().estimatedRefereeTotalCents, 0);
  fee = null;
  assert.equal((await save([firstId])).json().estimatedRefereeTotalCents, null);
  fee = 2147483647;
  assert.equal(
    (await save([firstId, secondId])).json().estimatedRefereeTotalCents,
    4294967294,
  );
  roster[1]!.status = "suspended";
  const detail = (
    await app.inject({ url: `/api/v1/matches/${matchId}`, headers })
  ).json();
  assert.equal(detail.hasSavedCallup, true);
  assert.equal(detail.callups[0].athleteId, secondId);
  assert.deepEqual(detail.warnings, [
    { athleteId: secondId, code: "ATHLETE_UNAVAILABLE" },
  ]);
  const empty = await save([]);
  assert.equal(empty.statusCode, 200);
  assert.equal(empty.json().hasSavedCallup, true);
  assert.deepEqual(empty.json().callups, []);
  assert.equal(empty.json().count, 0);
  const reopened = (
    await app.inject({ url: `/api/v1/matches/${matchId}`, headers })
  ).json();
  assert.equal(reopened.hasSavedCallup, true);
  assert.deepEqual(reopened.callups, []);
});

test(
  "PostgreSQL preserva convocações em falhas e restringe gravações ao responsável",
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
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/google",
        payload: { idToken },
      });
      assert.equal(response.statusCode, 200);
      return {
        user: response.json().user,
        headers: { authorization: `Bearer ${response.json().sessionToken}` },
      };
    }
    const owner = await login("owner");
    const follower = await login("follower");
    const otherFollower = await login("other-follower");
    const outsider = await login("outsider");
    const team = await db.team.create({
      data: {
        userId: owner.user.id,
        name: "Time",
        sport: "Futsal",
        category: "Sub-11",
      },
    });
    const otherTeam = await db.team.create({
      data: {
        userId: owner.user.id,
        name: "Outro",
        sport: "Futsal",
        category: "Sub-11",
      },
    });
    await db.teamFollow.createMany({
      data: [follower, otherFollower].map(({ user }) => ({
        userId: user.id,
        teamId: team.id,
      })),
    });
    const first = await db.athlete.create({
      data: {
        teamId: team.id,
        name: "Primeiro",
        position: "Goleiro",
        shirtNumber: 1,
      },
    });
    const second = await db.athlete.create({
      data: {
        teamId: team.id,
        name: "Segundo",
        position: "Atacante",
        shirtNumber: 9,
        status: "injured",
      },
    });
    const foreign = await db.athlete.create({
      data: {
        teamId: otherTeam.id,
        name: "Outro",
        position: "Goleiro",
        shirtNumber: 1,
      },
    });
    const match = await db.match.create({
      data: {
        teamId: team.id,
        startsAt: new Date(),
        opponent: "Rival",
        refereeFeeCents: 1500,
      },
    });
    const url = `/api/v1/matches/${match.id}/callups`;
    async function save(headers: typeof owner.headers, athleteIds: string[]) {
      return app.inject({
        method: "PUT",
        url,
        headers,
        payload: { athleteIds },
      });
    }
    assert.equal((await save(outsider.headers, [])).statusCode, 404);
    assert.equal((await save(owner.headers, [foreign.id])).statusCode, 422);
    assert.equal(
      (await db.match.findUniqueOrThrow({ where: { id: match.id } }))
        .hasSavedCallup,
      false,
    );
    assert.equal((await save(follower.headers, [second.id, first.id])).statusCode, 404);
    const initial = await save(owner.headers, [second.id, first.id]);
    assert.equal(initial.statusCode, 200, initial.body);
    assert.deepEqual(
      initial.json().callups.map((item: any) => item.athleteId),
      [first.id, second.id],
    );
    assert.equal((await save(follower.headers, [foreign.id])).statusCode, 404);
    assert.equal(await db.callup.count({ where: { matchId: match.id } }), 2);
    assert.equal((await save(owner.headers, [foreign.id])).statusCode, 422);
    const results = await Promise.all([
      save(owner.headers, [first.id]),
      save(owner.headers, [second.id]),
    ]);
    for (const result of results)
      assert.equal(result.statusCode, 200, result.body);
    const final = await db.callup.findMany({ where: { matchId: match.id } });
    assert.equal(final.length, 1);
    assert.ok([first.id, second.id].includes(final[0]!.athleteId));
    assert.equal((await save(otherFollower.headers, [])).statusCode, 404);
    assert.equal((await save(owner.headers, [])).statusCode, 200);
    const detail = await app.inject({
      url: `/api/v1/matches/${match.id}`,
      headers: owner.headers,
    });
    assert.equal(detail.json().hasSavedCallup, true);
    assert.deepEqual(detail.json().callups, []);
    await db.teamFollow.delete({
      where: { userId_teamId: { userId: follower.user.id, teamId: team.id } },
    });
    assert.equal((await save(follower.headers, [first.id])).statusCode, 404);
    assert.equal(await db.callup.count({ where: { matchId: match.id } }), 0);
  },
);
