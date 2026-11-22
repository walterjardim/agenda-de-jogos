import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import { Prisma, type PrismaClient } from '../src/generated/prisma/client.js';

const input = { name: 'Alex', position: 'Goleiro', shirtNumber: 0, status: 'active' };
const token = 'a'.repeat(43);
const headers = { authorization: `Bearer ${token}` };

test('rotas do elenco exigem sessão, validam dados e traduzem conflito de camisa', async (t) => {
  const userId = randomUUID();
  const teamId = randomUUID();
  const id = randomUUID();
  const list = `/api/v1/teams/${teamId}/athletes`;
  const item = `/api/v1/athletes/${id}`;
  const conflict = new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: 'test',
  });
  const create = t.mock.fn(async () => { throw conflict; });
  const updateManyAndReturn = t.mock.fn(async () => { throw conflict; });
  const db = {
    authSession: { findUnique: async () => ({ user: { id: userId } }) },
    athlete: { create, updateManyAndReturn },
  };
  const app = buildApp({
    db: db as unknown as PrismaClient,
    sessionTtlHours: 1,
    verifyGoogleIdentity: async () => { throw new Error('unused'); },
  });
  t.after(() => app.close());

  for (const [method, url] of [['GET', list], ['POST', list], ['PATCH', item], ['DELETE', item]] as const) {
    assert.equal((await app.inject({ method, url })).statusCode, 401);
  }
  for (const payload of [
    { ...input, shirtNumber: -1 },
    { ...input, shirtNumber: 1000 },
    { ...input, shirtNumber: 1.5 },
    { ...input, shirtNumber: '0' },
    { ...input, name: ' ' },
    { ...input, position: ' ' },
    { ...input, status: 'invalid' },
    { ...input, teamId },
  ]) {
    assert.equal((await app.inject({ method: 'POST', url: list, headers, payload })).statusCode, 400);
  }
  assert.equal((await app.inject({ method: 'PATCH', url: item, headers, payload: {} })).statusCode, 400);
  assert.equal((await app.inject({ method: 'GET', url: `${list}?cursor=invalid`, headers })).statusCode, 400);
  assert.equal((await app.inject({ method: 'GET', url: `${list}?status=unknown`, headers })).statusCode, 400);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(updateManyAndReturn.mock.callCount(), 0);
  for (const [method, url, payload] of [
    ['POST', list, input],
    ['PATCH', item, { shirtNumber: 1 }],
  ] as const) {
    const reply = await app.inject({ method, url, headers, payload });
    assert.equal(reply.statusCode, 409);
    assert.equal(reply.json().error.code, 'CONFLICT');
    assert.equal(reply.json().error.fields.shirtNumber, 'já está em uso');
  }
});

test('o cursor da API retoma a consulta pelo número da camisa, inclusive zero', async (t) => {
  const teamId = randomUUID();
  const userId = randomUUID();
  const url = `/api/v1/teams/${teamId}/athletes?limit=1&status=active&q=Alex`;
  const first = { ...input, id: randomUUID(), teamId };
  const second = { ...first, id: randomUUID(), shirtNumber: 999 };
  const db = {
    authSession: { findUnique: async () => ({ user: { id: userId } }) },
    team: {
      findUnique: async (args: Parameters<PrismaClient['team']['findUnique']>[0]) => {
        assert.deepEqual(args.where, {
          id: teamId,
          userId,
        });
        const query = args.select?.athletes;
        assert.ok(query && typeof query === 'object');
        assert.deepEqual(query.orderBy, { shirtNumber: 'asc' });
        assert.equal(query.take, 2);
        const result = query.where?.shirtNumber ? [second] : [first, second];
        assert.deepEqual(query.where, {
          name: { contains: 'Alex', mode: 'insensitive' },
          status: 'active',
          ...(result.length === 1 ? { shirtNumber: { gt: 0 } } : {}),
        });
        return { athletes: result };
      },
    },
  };
  const app = buildApp({
    db: db as unknown as PrismaClient,
    sessionTtlHours: 1,
    verifyGoogleIdentity: async () => { throw new Error('unused'); },
  });
  t.after(() => app.close());

  const page = await app.inject({ url, headers });
  assert.equal(page.statusCode, 200);
  assert.deepEqual(page.json().data, [first]);
  assert.ok(page.json().nextCursor);
  const next = await app.inject({ url: `${url}&cursor=${page.json().nextCursor}`, headers });
  assert.equal(next.statusCode, 200);
  assert.deepEqual(next.json(), { data: [second], nextCursor: null });
});

test('persiste elenco, isola permissões e mantém paginação após excluir o cursor', {
  skip: process.env.TEST_DATABASE_URL ? false : 'Configure TEST_DATABASE_URL com PostgreSQL de teste migrado',
}, async (t) => {
  const db = createDatabase(process.env.TEST_DATABASE_URL!);
  const prefix = randomUUID();
  const app = buildApp({
    db,
    sessionTtlHours: 1,
    verifyGoogleIdentity: async (sub) => ({ sub: `${prefix}-${sub}`, email: `${sub}@example.com`, name: sub }),
  });
  t.after(async () => {
    await app.close();
    try { await db.user.deleteMany({ where: { googleSub: { startsWith: prefix } } }); }
    finally { await db.$disconnect(); }
  });
  async function login(idToken: string) {
    const reply = await app.inject({ method: 'POST', url: '/api/v1/auth/google', payload: { idToken } });
    assert.equal(reply.statusCode, 200);
    return { authorization: `Bearer ${reply.json().sessionToken}` };
  }
  const owner = await login('owner');
  const other = await login('other');
  async function createTeam() {
    const reply = await app.inject({
      method: 'POST', url: '/api/v1/teams', headers: owner,
      payload: { name: 'Ajax', sport: 'Futebol', category: 'Sub-17' },
    });
    assert.equal(reply.statusCode, 201);
    return `/api/v1/teams/${reply.json().id}`;
  }
  const team = await createTeam();
  const anotherTeam = await createTeam();
  const url = `${team}/athletes`;
  assert.equal((await app.inject({ url, headers: other })).statusCode, 404);
  assert.deepEqual((await app.inject({ url, headers: owner })).json(), { data: [], nextCursor: null });

  const create = (path: string, shirtNumber: number, name = ' Alex ') =>
    app.inject({ method: 'POST', url: path, headers: owner, payload: { name, position: 'x'.repeat(81), shirtNumber } });
  const concurrent = await Promise.all([create(url, 999), create(url, 999)]);
  assert.deepEqual(concurrent.map((reply) => reply.statusCode).sort(), [201, 409]);
  const created = concurrent.find((reply) => reply.statusCode === 201)!.json();
  assert.equal(created.name, 'Alex');
  assert.equal(created.teamId, team.split('/').at(-1));
  assert.equal(created.status, 'active');
  assert.equal((await create(url, 0, 'João')).statusCode, 201);
  assert.equal((await create(`${anotherTeam}/athletes`, 0)).statusCode, 201);

  assert.equal((await app.inject({ method: 'PUT', url: `${team}/follow`, headers: other })).statusCode, 200);
  assert.equal((await app.inject({ url, headers: other })).statusCode, 404);
  const first = (await app.inject({ url: `${url}?limit=1`, headers: owner })).json();
  const item = `/api/v1/athletes/${first.data[0].id}`;
  assert.equal(first.data[0].shirtNumber, 0);
  assert.ok(first.nextCursor);
  const filtered = await app.inject({ url: `${url}?status=active&q=JO%C3%83O`, headers: owner });
  assert.deepEqual(filtered.json(), { data: first.data, nextCursor: null });
  assert.equal((await app.inject({ method: 'POST', url, headers: other, payload: input })).statusCode, 403);
  assert.equal((await app.inject({ method: 'PATCH', url: item, headers: other, payload: { status: 'injured' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'DELETE', url: item, headers: other })).statusCode, 403);
  assert.equal((await app.inject({
    method: 'POST', url: `${anotherTeam}/athletes`, headers: other, payload: input,
  })).statusCode, 404);

  const changed = await app.inject({ method: 'PATCH', url: item, headers: owner, payload: { status: 'injured' } });
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.json().status, 'injured');
  assert.deepEqual((await app.inject({ url: `${url}?status=active&q=Jo%C3%A3o`, headers: other })).json(), {
    data: [], nextCursor: null,
  });
  assert.equal((await app.inject({ method: 'DELETE', url: item, headers: owner })).statusCode, 204);
  const last = (await app.inject({ url: `${url}?limit=1&cursor=${first.nextCursor}`, headers: owner })).json();
  assert.equal(last.data.length, 1);
  assert.equal(last.data[0].shirtNumber, 999);
  assert.equal(last.nextCursor, null);
  assert.equal((await app.inject({ method: 'DELETE', url: team, headers: owner })).statusCode, 204);
  assert.equal(await db.athlete.count({ where: { id: last.data[0].id } }), 0);
});
