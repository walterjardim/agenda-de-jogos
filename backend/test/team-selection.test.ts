import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

test('busca autenticada, paginação e seleção atômica sem expor dados do dono', async (t) => {
  const userId = randomUUID();
  const ids = [randomUUID(), randomUUID(), randomUUID()].sort();
  const teams = ids.map((id) => ({ id, name: 'Ajax', sport: 'Futebol', category: 'Sub-17', userId: randomUUID(), createdAt: new Date() }));
  let activeTeamId: string | null = null;
  let lastQuery: any;
  let inTransaction = false;
  const followed = new Set<string>();
  let sessionValid = true;
  const profile = () => ({ id: userId, name: 'Usuário', email: 'user@example.com', timezone: 'America/Sao_Paulo', activeTeamId });
  const tx = {
    $queryRaw: async (_strings: TemplateStringsArray, id: string) => teams.filter((team) => team.id === id).map((team) => ({ id: team.id, user_id: team.userId })),
    teamFollow: { upsert: async ({ create }: any) => { assert.ok(inTransaction); assert.equal(create.userId, userId); followed.add(create.teamId); } },
    user: { update: async ({ where, data }: any) => { assert.ok(inTransaction); assert.equal(where.id, userId); activeTeamId = data.activeTeamId; return profile(); } },
  };
  const db = {
    authSession: { findUnique: async () => sessionValid ? { id: randomUUID(), user: profile() } : null },
    team: {
      findMany: async (query: any) => { lastQuery = query; return teams.filter((team) => !query.where.id || team.id > query.where.id.gt).slice(0, query.take); },
      findUnique: async ({ where }: any) => teams.find((team) => team.id === where.id) ?? null,
    },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
      inTransaction = true;
      try { return await callback(tx); } finally { inTransaction = false; }
    },
  };
  const app = buildApp({ db: db as unknown as PrismaClient, sessionTtlHours: 1, verifyGoogleIdentity: async () => { throw new Error('unused'); } });
  t.after(() => app.close());
  const headers = { authorization: `Bearer ${'a'.repeat(43)}` };
  for (const [method, url] of [['GET', '/teams'], ['GET', `/teams/${ids[0]}`], ['POST', `/teams/${ids[0]}/select`]] as const) {
    assert.equal((await app.inject({ method, url: `/api/v1${url}` })).statusCode, 401);
  }
  for (const url of ['/teams?limit=0', '/teams?limit=51', '/teams?cursor=bad', '/teams?q=' + 'x'.repeat(101), '/teams?mine=anything', '/teams/invalid']) {
    assert.equal((await app.inject({ method: 'GET', url: `/api/v1${url}`, headers })).statusCode, 400);
  }
  const first = await app.inject({ method: 'GET', url: '/api/v1/teams?q=%20Ajax%20&limit=2&mine=true', headers });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().data.length, 2);
  assert.equal(first.json().nextCursor, ids[1]);
  assert.equal(first.json().data[0].userId, undefined);
  assert.equal(first.json().data[0].isOwner, false);
  assert.deepEqual(lastQuery.where.name, { contains: 'Ajax', mode: 'insensitive' });
  assert.deepEqual(lastQuery.where.OR, [{ userId }, { followers: { some: { userId } } }]);
  const next = await app.inject({ method: 'GET', url: `/api/v1/teams?limit=2&cursor=${ids[1]}`, headers });
  assert.deepEqual(next.json().data.map((team: { id: string }) => team.id), [ids[2]]);
  assert.equal(next.json().nextCursor, null);
  const detail = await app.inject({ method: 'GET', url: `/api/v1/teams/${ids[0]}`, headers });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().userId, undefined);
  for (const id of [ids[0], ids[1], ids[1]]) {
    const result = await app.inject({ method: 'POST', url: `/api/v1/teams/${id}/select`, headers });
    assert.equal(result.statusCode, 200);
    assert.equal(result.json().activeTeamId, id);
  }
  assert.equal(followed.size, 2);
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/me', headers })).json().activeTeamId, ids[1]);
  assert.equal((await app.inject({ method: 'POST', url: `/api/v1/teams/${randomUUID()}/select`, headers })).statusCode, 404);
  assert.equal(activeTeamId, ids[1]);
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/teams/invalid/select', headers })).statusCode, 400);
  sessionValid = false;
  assert.equal((await app.inject({ method: 'POST', url: `/api/v1/teams/${ids[0]}/select`, headers })).statusCode, 401);
});
