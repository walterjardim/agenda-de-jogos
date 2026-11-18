import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

const token = 'a'.repeat(43);
const headers = { authorization: `Bearer ${token}` };
const input = { name: 'Ajax', sport: 'Futebol', category: 'Sub-17' };

test('rotas de equipes exigem sessão e validam entrada antes de gravar', async (t) => {
  const unused = async (..._args: any[]): Promise<any> => { throw new Error('Unexpected database call'); };
  const db = {
    authSession: { findUnique: unused },
    team: { create: unused, findMany: unused, updateManyAndReturn: unused, deleteMany: unused },
  };
  const app = buildApp({ db: db as unknown as PrismaClient, sessionTtlHours: 1, verifyGoogleIdentity: async () => { throw new Error('unused'); } });
  t.after(async () => { await app.close(); });
  const userId = randomUUID();
  t.mock.method(db.authSession, 'findUnique', async () => ({ id: randomUUID(), user: { id: userId } }));
  const create = t.mock.method(db.team, 'create', async ({ data }) => ({ id: randomUUID(), ...data }));
  for (const [method, url] of [['GET', '/me/teams'], ['POST', '/teams'], ['PATCH', `/teams/${randomUUID()}`], ['DELETE', `/teams/${randomUUID()}`]] as const) {
    const result = await app.inject({ method, url: `/api/v1${url}` });
    assert.equal(result.statusCode, 401);
  }
  for (const payload of [{ ...input, name: '  ' }, { ...input, sport: '' }, { ...input, category: 'x'.repeat(61) }, { ...input, userId: randomUUID() }, { name: 'Ajax' }]) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/teams', headers, payload })).statusCode, 400);
  }
  assert.equal(create.mock.callCount(), 0);
  assert.equal((await app.inject({ method: 'PATCH', url: `/api/v1/teams/${randomUUID()}`, headers, payload: {} })).statusCode, 400);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/v1/teams/invalid', headers })).statusCode, 400);
  const created = await app.inject({ method: 'POST', url: '/api/v1/teams', headers, payload: { ...input, name: ' Ajax ' } });
  assert.equal(created.statusCode, 201);
  assert.equal(create.mock.calls[0]!.arguments[0].data.userId, userId);
  assert.equal(created.json().name, 'Ajax');
  assert.equal(created.headers['cache-control'], 'no-store');

  t.mock.method(db.team, 'findMany', async ({ where }) => { assert.deepEqual(where, { userId }); return []; });
  assert.deepEqual((await app.inject({ method: 'GET', url: '/api/v1/me/teams', headers })).json(), []);
  const id = randomUUID();
  t.mock.method(db.team, 'updateManyAndReturn', async ({ where }) => { assert.deepEqual(where, { id, userId }); return []; });
  t.mock.method(db.team, 'deleteMany', async ({ where }) => { assert.deepEqual(where, { id, userId }); return { count: 0 }; });
  assert.equal((await app.inject({ method: 'PATCH', url: `/api/v1/teams/${id}`, headers, payload: { name: 'Outro' } })).statusCode, 404);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/teams/${id}`, headers })).statusCode, 404);
  t.mock.method(db.authSession, 'findUnique', async () => null);
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/me/teams', headers })).statusCode, 401);
});

test('persiste CRUD, isola proprietários e limpa seguidores e seleção ao excluir', {
  skip: process.env.TEST_DATABASE_URL ? false : 'Configure TEST_DATABASE_URL com PostgreSQL de teste migrado',
}, async (t) => {
  const db = createDatabase(process.env.TEST_DATABASE_URL!);
  const prefix = randomUUID();
  const app = buildApp({ db, sessionTtlHours: 1, verifyGoogleIdentity: async (sub) => ({ sub: `${prefix}-${sub}`, email: `${sub}@example.com`, name: sub }) });
  t.after(async () => {
    await app.close();
    try { await db.user.deleteMany({ where: { googleSub: { startsWith: prefix } } }); }
    finally { await db.$disconnect(); }
  });
  const login = async (idToken: string) => (await app.inject({ method: 'POST', url: '/api/v1/auth/google', payload: { idToken } })).json();
  const owner = await login('owner');
  const other = await login('other');
  const ownerHeaders = { authorization: `Bearer ${owner.sessionToken}` };
  const otherHeaders = { authorization: `Bearer ${other.sessionToken}` };
  const created = await app.inject({ method: 'POST', url: '/api/v1/teams', headers: ownerHeaders, payload: input });
  assert.equal(created.statusCode, 201);
  const id = created.json().id;
  assert.equal((await db.team.findUniqueOrThrow({ where: { id } })).userId, owner.user.id);
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/me/teams', headers: ownerHeaders })).json()[0].id, id);
  assert.deepEqual((await app.inject({ method: 'GET', url: '/api/v1/me/teams', headers: otherHeaders })).json(), []);
  for (const method of ['PATCH', 'DELETE'] as const) {
    assert.equal((await app.inject({ method, url: `/api/v1/teams/${id}`, headers: otherHeaders, ...(method === 'PATCH' ? { payload: { name: 'Invadido' } } : {}) })).statusCode, 404);
  }
  const updated = await app.inject({ method: 'PATCH', url: `/api/v1/teams/${id}`, headers: ownerHeaders, payload: { name: 'Ajax atualizado' } });
  assert.equal(updated.statusCode, 200);
  assert.equal((await db.team.findUniqueOrThrow({ where: { id } })).name, 'Ajax atualizado');
  const second = await app.inject({ method: 'POST', url: '/api/v1/teams', headers: ownerHeaders, payload: { ...input, name: 'Segundo time' } });
  const secondId = second.json().id;
  for (const teamId of [id, secondId, secondId]) {
    const chosen = await app.inject({ method: 'POST', url: `/api/v1/teams/${teamId}/select`, headers: otherHeaders });
    assert.equal(chosen.statusCode, 200);
    assert.equal(chosen.json().activeTeamId, teamId);
  }
  assert.equal(await db.teamFollow.count({ where: { userId: other.user.id } }), 2);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: other.user.id } })).activeTeamId, secondId);
  const restored = await app.inject({ method: 'GET', url: '/api/v1/me', headers: otherHeaders });
  assert.equal(restored.json().activeTeamId, secondId);
  assert.equal((await login('other')).user.activeTeamId, secondId);
  const mine = await app.inject({ method: 'GET', url: '/api/v1/teams?mine=true', headers: otherHeaders });
  assert.deepEqual(new Set(mine.json().data.map((team: { id: string }) => team.id)), new Set([id, secondId]));
  const search = await app.inject({ method: 'GET', url: '/api/v1/teams?q=AJAX%20ATUALIZADO', headers: otherHeaders });
  assert.ok(search.json().data.some((team: { id: string }) => team.id === id));
  const missing = await app.inject({ method: 'POST', url: `/api/v1/teams/${randomUUID()}/select`, headers: otherHeaders });
  assert.equal(missing.statusCode, 404);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: other.user.id } })).activeTeamId, secondId);
  await app.inject({ method: 'POST', url: `/api/v1/teams/${id}/select`, headers: otherHeaders });
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/teams/${id}`, headers: ownerHeaders })).statusCode, 204);
  assert.equal(await db.team.findUnique({ where: { id } }), null);
  assert.equal(await db.teamFollow.count({ where: { teamId: id } }), 0);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: other.user.id } })).activeTeamId, null);
});
