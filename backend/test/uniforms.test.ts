import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

test('uniformes validam entradas, autorização e troca dos padrões na transação', async (t) => {
  const userId = randomUUID();
  const teamId = randomUUID();
  const id = randomUUID();
  let owner = true;
  let following = true;
  let exists = true;
  let locked = false;
  const cleared: unknown[] = [];
  const piece = { id, teamId, pieceType: 'shirt', uniformName: 'Casa', description: 'Azul', colorHex: '#000000', isHomeDefault: false, isAwayDefault: false };
  const tx = {
    $queryRaw: async () => { locked = true; return [{ user_id: owner ? userId : randomUUID() }]; },
    teamFollow: { findUnique: async () => following ? { teamId } : null },
    uniformPiece: {
      findUnique: async () => exists ? piece : null,
      updateMany: async (args: unknown) => { assert.equal(locked, true); cleared.push(args); return { count: 1 }; },
      create: async ({ data }: any) => { assert.equal(locked, true); return { ...piece, ...data }; },
      update: async ({ data }: any) => { assert.equal(locked, true); return { ...piece, ...data }; },
      delete: async () => { assert.equal(locked, true); return piece; },
    },
  };
  const db = {
    authSession: { findUnique: async () => ({ user: { id: userId } }) },
    $transaction: async (callback: any) => { locked = false; return callback(tx); },
    team: { findUnique: async ({ select }: any) => {
      assert.equal(select.uniformPieces.where.pieceType, 'shirt');
      return owner || following ? { uniformPieces: [piece] } : null;
    } },
  };
  const app = buildApp({ db: db as unknown as PrismaClient, sessionTtlHours: 1, verifyGoogleIdentity: async () => { throw new Error('unused'); } });
  t.after(() => app.close());
  const headers = { authorization: `Bearer ${'a'.repeat(43)}` };
  const list = `/api/v1/teams/${teamId}/uniforms`;
  const item = `/api/v1/uniforms/${id}`;
  for (const [method, url] of [['GET', list], ['POST', list], ['PATCH', item], ['DELETE', item]] as const) {
    assert.equal((await app.inject({ method, url })).statusCode, 401);
  }
  for (const payload of [{}, { pieceType: 'hat', uniformName: 'Casa', description: 'Azul' }, { ...piece, uniformName: '' }, { pieceType: 'shirt', uniformName: 'Casa', description: 'Azul', colorHex: 'blue' }]) {
    assert.equal((await app.inject({ method: 'POST', url: list, headers, payload })).statusCode, 400);
  }
  for (const payload of [{}, { pieceType: 'shorts' }, { teamId }, { colorHex: '#FFF' }, { uniformName: 'x'.repeat(81) }, { description: null }, { isHomeDefault: 'true' }]) {
    assert.equal((await app.inject({ method: 'PATCH', url: item, headers, payload })).statusCode, 400);
  }
  const created = await app.inject({ method: 'POST', url: list, headers, payload: { pieceType: 'shirt', uniformName: ' Casa ', description: ' Azul ' } });
  assert.equal(created.statusCode, 201);
  assert.deepEqual(created.json(), piece);
  assert.equal(cleared.length, 0);
  const changed = await app.inject({ method: 'PATCH', url: item, headers, payload: { isHomeDefault: true, isAwayDefault: true } });
  assert.equal(changed.statusCode, 200);
  assert.deepEqual(cleared, ['isHomeDefault', 'isAwayDefault'].map((flag) => ({ where: { teamId, pieceType: 'shirt', [flag]: true }, data: { [flag]: false } })));
  cleared.length = 0;
  assert.equal((await app.inject({ method: 'PATCH', url: item, headers, payload: { description: 'Outra', isHomeDefault: false } })).statusCode, 200);
  assert.equal(cleared.length, 0);
  assert.equal((await app.inject({ url: `${list}?pieceType=shirt`, headers })).json().data.length, 1);
  assert.equal((await app.inject({ url: `${list}?pieceType=hat`, headers })).statusCode, 400);
  assert.equal((await app.inject({ url: `${list}?cursor=bad`, headers })).statusCode, 400);
  assert.equal((await app.inject({ method: 'DELETE', url: item, headers })).statusCode, 204);
  owner = false;
  for (const [method, url, payload] of [['POST', list, { pieceType: 'shirt', uniformName: 'Casa', description: 'Azul' }], ['PATCH', item, { description: 'Outra' }], ['DELETE', item, undefined]] as const) {
    assert.equal((await app.inject({ method, url, headers, payload })).statusCode, 403);
    following = false;
    assert.equal((await app.inject({ method, url, headers, payload })).statusCode, 404);
    following = true;
  }
  exists = false;
  assert.equal((await app.inject({ method: 'DELETE', url: item, headers })).statusCode, 404);
});

test('padrões concorrentes e exclusão preservam outras peças e jogos no PostgreSQL', {
  skip: process.env.TEST_DATABASE_URL ? false : 'Configure TEST_DATABASE_URL com PostgreSQL migrado',
}, async (t) => {
  const db = createDatabase(process.env.TEST_DATABASE_URL!);
  const prefix = randomUUID();
  const app = buildApp({ db, sessionTtlHours: 1, verifyGoogleIdentity: async (sub) => ({ sub: prefix + sub, email: `${sub}@example.com`, name: sub }) });
  t.after(async () => {
    await app.close();
    try { await db.user.deleteMany({ where: { googleSub: { startsWith: prefix } } }); }
    finally { await db.$disconnect(); }
  });
  const login = await app.inject({ method: 'POST', url: '/api/v1/auth/google', payload: { idToken: 'owner' } });
  const headers = { authorization: `Bearer ${login.json().sessionToken}` };
  const team = await app.inject({ method: 'POST', url: '/api/v1/teams', headers, payload: { name: 'Time', sport: 'Futsal', category: 'Sub-11' } });
  const teamId = team.json().id;
  async function create(pieceType: string, uniformName: string) {
    const response = await app.inject({ method: 'POST', url: `/api/v1/teams/${teamId}/uniforms`, headers,
      payload: { pieceType, uniformName, description: 'Azul', isHomeDefault: true, isAwayDefault: true } });
    assert.equal(response.statusCode, 201, response.body);
    return response.json();
  }
  const [first, second] = await Promise.all([create('shirt', 'Casa'), create('shirt', 'Fora')]);
  const shorts = await create('shorts', 'Casa');
  assert.equal(await db.uniformPiece.count({ where: { teamId, pieceType: 'shirt', isHomeDefault: true } }), 1);
  assert.equal(await db.uniformPiece.count({ where: { teamId, pieceType: 'shirt', isAwayDefault: true } }), 1);
  const match = await db.match.create({ data: { teamId, opponent: 'Rival', startsAt: new Date(), shirtPieceId: first.id, shortsPieceId: shorts.id, refereeFeeCents: 0 } });
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/uniforms/${first.id}`, headers })).statusCode, 204);
  const saved = await db.match.findUniqueOrThrow({ where: { id: match.id } });
  assert.equal(saved.shirtPieceId, null);
  assert.equal(saved.shortsPieceId, shorts.id);
  assert.equal(saved.refereeFeeCents, 0);
  assert.ok(await db.uniformPiece.findUnique({ where: { id: second.id } }));
});
