import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { Prisma, type PrismaClient } from '../src/generated/prisma/client.js';

test('competições validam contrato, paginação e permissões de criador/seguidor', async (t) => {
  const userId = randomUUID();
  const teamId = randomUUID();
  const id = randomUUID();
  const record = { id, teamId, name: 'Copa' };
  const headers = { authorization: `Bearer ${'a'.repeat(43)}` };
  let owner = true;
  let following = true;
  const db = {
    authSession: { findUnique: async () => ({ user: { id: userId } }) },
    team: {
      findUnique: async ({ where }: any) => {
        assert.deepEqual(where.OR, [{ userId }, { followers: { some: { userId } } }]);
        return owner || following ? { competitions: [record] } : null;
      },
    },
    teamFollow: { findUnique: async () => following ? { teamId } : null },
    competition: {
      create: async ({ data }: any) => {
        assert.deepEqual(data.team.connect, { id: teamId, userId });
        if (!owner) throw new Prisma.PrismaClientKnownRequestError('missing', { code: 'P2025', clientVersion: 'test' });
        return { ...record, name: data.name };
      },
      updateManyAndReturn: async ({ where, data }: any) => {
        assert.deepEqual(where, { id, team: { userId } });
        return owner ? [{ ...record, ...data }] : [];
      },
      deleteMany: async ({ where }: any) => {
        assert.deepEqual(where, { id, team: { userId } });
        return { count: owner ? 1 : 0 };
      },
      findUnique: async () => following ? { id } : null,
    },
  };
  const app = buildApp({
    db: db as unknown as PrismaClient, sessionTtlHours: 1,
    verifyGoogleIdentity: async () => { throw new Error('unused'); },
  });
  t.after(() => app.close());
  const list = `/api/v1/teams/${teamId}/competitions`;
  const item = `/api/v1/competitions/${id}`;
  for (const [method, url] of [['GET', list], ['POST', list], ['PATCH', item], ['DELETE', item]] as const) {
    assert.equal((await app.inject({ method, url })).statusCode, 401);
  }
  for (const payload of [{}, { name: '' }, { name: 'x'.repeat(121) }, { name: 'Copa', refereeFeeCents: 10 }, { name: null }, { name: 'Copa', teamId }]) {
    for (const [method, url] of [['POST', list], ['PATCH', item]] as const) {
      assert.equal((await app.inject({ method, url, headers, payload })).statusCode, 400);
    }
  }
  assert.equal((await app.inject({ url: `${list}?cursor=bad`, headers })).statusCode, 400);
  assert.equal((await app.inject({ url: `${list}?limit=51`, headers })).statusCode, 400);
  const created = await app.inject({ method: 'POST', url: list, headers, payload: { name: ' Copa ' } });
  assert.equal(created.statusCode, 201);
  assert.deepEqual(created.json(), record);
  assert.equal(created.headers['cache-control'], 'no-store');
  assert.deepEqual((await app.inject({ url: list, headers })).json(), { data: [record], nextCursor: null });
  const changed = await app.inject({ method: 'PATCH', url: item, headers, payload: { name: 'Outra' } });
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.json().name, 'Outra');
  assert.equal((await app.inject({ method: 'DELETE', url: item, headers })).statusCode, 204);
  owner = false;
  assert.equal((await app.inject({ url: list, headers })).statusCode, 200);
  for (const [method, url] of [['POST', list], ['PATCH', item], ['DELETE', item]] as const) {
    assert.equal((await app.inject({ method, url, headers, ...(method !== 'DELETE' ? { payload: { name: 'Copa' } } : {}) })).statusCode, 403);
  }
  following = false;
  assert.equal((await app.inject({ url: list, headers })).statusCode, 404);
  for (const [method, url] of [['POST', list], ['PATCH', item], ['DELETE', item]] as const) {
    assert.equal((await app.inject({ method, url, headers, ...(method !== 'DELETE' ? { payload: { name: 'Copa' } } : {}) })).statusCode, 404);
  }
});

test('persiste competições e remove cadastros em cascata com o time', {
  skip: process.env.TEST_DATABASE_URL ? false : 'Configure TEST_DATABASE_URL com PostgreSQL migrado',
}, async (t) => {
  const db = createDatabase(process.env.TEST_DATABASE_URL!);
  const prefix = randomUUID();
  const app = buildApp({
    db, sessionTtlHours: 1,
    verifyGoogleIdentity: async (sub) => ({ sub: prefix + sub, email: sub + '@example.com', name: sub }),
  });
  t.after(async () => {
    await app.close();
    try { await db.user.deleteMany({ where: { googleSub: { startsWith: prefix } } }); }
    finally { await db.$disconnect(); }
  });
  async function login(idToken: string) {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/google', payload: { idToken } });
    assert.equal(response.statusCode, 200);
    return { authorization: 'Bearer ' + response.json().sessionToken };
  }
  const owner = await login('owner');
  const follower = await login('follower');
  const teamResponse = await app.inject({
    method: 'POST', url: '/api/v1/teams', headers: owner,
    payload: { name: 'Time', sport: 'Futebol', category: 'Sub-17' },
  });
  assert.equal(teamResponse.statusCode, 201);
  const teamId = teamResponse.json().id;
  const list = `/api/v1/teams/${teamId}/competitions`;
  assert.equal((await app.inject({ url: list, headers: follower })).statusCode, 404);
  assert.equal((await app.inject({
    method: 'POST', url: `/api/v1/teams/${teamId}/select`, headers: follower,
  })).statusCode, 200);
  const created = await app.inject({ method: 'POST', url: list, headers: owner, payload: { name: 'Copa' } });
  assert.equal(created.statusCode, 201);
  const id = created.json().id;
  assert.equal(created.json().teamId, teamId);
  assert.equal((await app.inject({ url: list, headers: follower })).json().data[0].id, id);
  const item = `/api/v1/competitions/${id}`;
  assert.equal((await app.inject({
    method: 'PATCH', url: item, headers: follower, payload: { name: 'Outra' },
  })).statusCode, 403);
  assert.equal((await app.inject({ method: 'DELETE', url: item, headers: follower })).statusCode, 403);
  assert.equal((await app.inject({
    method: 'PATCH', url: item, headers: owner, payload: { name: 'Outra' },
  })).statusCode, 200);
  assert.equal((await db.competition.findUniqueOrThrow({ where: { id } })).name, 'Outra');
  assert.equal((await app.inject({ method: 'DELETE', url: item, headers: owner })).statusCode, 204);
  assert.equal(await db.competition.count({ where: { id } }), 0);
  assert.equal((await app.inject({ method: 'POST', url: list, headers: owner, payload: { name: 'Nova' } })).statusCode, 201);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/teams/${teamId}`, headers: owner })).statusCode, 204);
  assert.equal(await db.competition.count({ where: { teamId } }), 0);
});

test('paginação retoma após o cursor mesmo sem o registro anterior', async (t) => {
  const teamId = randomUUID();
  const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
  ];
  let rows = ids.map((id) => ({ id, teamId, name: 'Copa' }));
  const db = {
    authSession: { findUnique: async () => ({ user: { id: randomUUID() } }) },
    team: {
      findUnique: async ({ select }: any) => {
        const { where, take, orderBy } = select.competitions;
        assert.deepEqual(orderBy, { id: 'asc' });
        return { competitions: rows.filter((row) => !where.id || row.id > where.id.gt).slice(0, take) };
      },
    },
  };
  const app = buildApp({
    db: db as unknown as PrismaClient, sessionTtlHours: 1,
    verifyGoogleIdentity: async () => { throw new Error('unused'); },
  });
  t.after(() => app.close());
  const url = `/api/v1/teams/${teamId}/competitions?limit=1`;
  const headers = { authorization: `Bearer ${'a'.repeat(43)}` };
  const first = (await app.inject({ url, headers })).json();
  assert.equal(first.data[0].id, ids[0]);
  assert.ok(first.nextCursor);
  rows = rows.slice(1);
  const second = (await app.inject({ url: `${url}&cursor=${first.nextCursor}`, headers })).json();
  assert.equal(second.data[0].id, ids[1]);
  const last = (await app.inject({ url: `${url}&cursor=${second.nextCursor}`, headers })).json();
  assert.equal(last.data[0].id, ids[2]);
  assert.equal(last.nextCursor, null);
});
