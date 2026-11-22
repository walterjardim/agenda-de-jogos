import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { OAuth2Client } from 'google-auth-library';
import { buildApp } from '../src/app.js';
import { createGoogleVerifier, type VerifyGoogleIdentity } from '../src/auth/google.js';
import { createDatabase } from '../src/database.js';

const audience = 'test.apps.googleusercontent.com';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const certificates = createServer((request, response) => {
  if (request.url === '/unavailable') {
    response.writeHead(403).end();
    return;
  }

  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'public, max-age=3600');
  response.end(
    JSON.stringify({
      fixture: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    }),
  );
});

let certsUrl: string;
let verifyGoogleIdentity: VerifyGoogleIdentity;

function verifier(path: string) {
  const client = new OAuth2Client({
    endpoints: { oauth2FederatedSignonPemCertsUrl: certsUrl + path },
  });
  return createGoogleVerifier([audience], client);
}

before(async () => {
  certificates.listen(0, '127.0.0.1');
  await once(certificates, 'listening');
  const address = certificates.address();
  assert.ok(address && typeof address !== 'string');
  certsUrl = `http://127.0.0.1:${address.port}`;
  verifyGoogleIdentity = verifier('/certs');
});

after(async () => {
  await new Promise<void>((resolve) => certificates.close(() => resolve()));
});

test('reporta indisponibilidade ao buscar as chaves públicas do provedor', async () => {
  await assert.rejects(verifier('/unavailable')(googleToken()), { statusCode: 503 });
});

function googleToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString(
    'base64url',
  );
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'fixture-sub',
      email: 'treinador@example.com',
      email_verified: true,
      name: 'Treinador',
      iss: 'https://accounts.google.com',
      aud: audience,
      iat: now - 300,
      exp: now + 3600,
      ...overrides,
    }),
  ).toString('base64url');
  const data = `${header}.${payload}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
}

test('valida assinatura, emissor, audiência, expiração e e-mail verificado', async () => {
  const valid = googleToken();
  assert.deepEqual(await verifyGoogleIdentity(valid), {
    sub: 'fixture-sub',
    email: 'treinador@example.com',
    name: 'Treinador',
  });

  const invalidClaims = [
    { aud: 'outro.apps.googleusercontent.com' },
    { iss: 'https://example.com' },
    { exp: Math.floor(Date.now() / 1000) - 5 },
    { email_verified: false },
    { sub: null },
  ];
  for (const claims of invalidClaims) {
    await assert.rejects(verifyGoogleIdentity(googleToken(claims)), { statusCode: 401 });
  }

  const [header, payload, signature] = valid.split('.');
  const forged = Buffer.from(signature!, 'base64url');
  forged[0] = forged[0]! ^ 1;
  await assert.rejects(
    verifyGoogleIdentity(`${header}.${payload}.${forged.toString('base64url')}`),
    { statusCode: 401 },
  );
});

test('login limita tentativas por IP e não repete tokens na resposta de erro', async (t) => {
  const db = createDatabase('postgresql://test:test@localhost:5432/unused');
  const app = buildApp({ db, sessionTtlHours: 1, verifyGoogleIdentity });
  t.after(async () => {
    await app.close();
    await db.$disconnect();
  });

  const payload = { idToken: 'token-invalido-privado' };
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google',
      payload,
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.includes(payload.idToken), false);
  }

  const limited = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/google',
    payload,
  });
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error.code, 'RATE_LIMITED');
  assert.ok(limited.headers['retry-after']);
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test(
  'cria conta e sessão no PostgreSQL, preserva preferências e revoga sessões',
  {
    skip: testDatabaseUrl
      ? false
      : 'Configure TEST_DATABASE_URL com um PostgreSQL de teste migrado',
  },
  async (t) => {
    assert.ok(testDatabaseUrl);
    const db = createDatabase(testDatabaseUrl);
    const app = buildApp({ db, sessionTtlHours: 1, verifyGoogleIdentity });
    const googleSub = randomUUID();
    const otherSub = randomUUID();
    t.after(async () => {
      await app.close();
      try {
        await db.user.deleteMany({ where: { googleSub: { in: [googleSub, otherSub] } } });
      } finally {
        await db.$disconnect();
      }
    });

    const login = (claims: Record<string, unknown> = {}) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/google',
        payload: { idToken: googleToken({ sub: googleSub, ...claims }) },
      });

    const securedTables = await db.$queryRaw<{ relname: string }[]>`
    SELECT relname FROM pg_class
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE nspname = 'public' AND relrowsecurity
      AND relname IN ('users', 'auth_sessions', 'teams', 'team_follows')
    ORDER BY relname
  `;
    assert.deepEqual(
      securedTables.map(({ relname }) => relname),
      ['auth_sessions', 'team_follows', 'teams', 'users'],
    );

    const missingSession = await app.inject({ method: 'GET', url: '/api/v1/me' });
    assert.equal(missingSession.statusCode, 401);

    const invalidBody = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google',
      payload: { idToken: googleToken({ sub: googleSub }), userId: otherSub },
    });
    assert.equal(invalidBody.statusCode, 400);
    assert.equal(await db.user.count({ where: { googleSub } }), 0);

    const [first, concurrent] = await Promise.all([login(), login()]);
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(concurrent.statusCode, 200, concurrent.body);
    assert.equal(first.headers['cache-control'], 'no-store');

    const initial = first.json();
    const secondSession = concurrent.json();
    assert.equal(secondSession.user.id, initial.user.id);
    assert.notEqual(secondSession.sessionToken, initial.sessionToken);
    assert.equal(initial.user.timezone, 'America/Sao_Paulo');
    assert.equal(initial.user.activeTeamId, null);
    assert.equal(await db.user.count({ where: { googleSub } }), 1);
    assert.equal(Object.hasOwn(initial.user, 'googleSub'), false);

    const userId = initial.user.id as string;
    const tokenHash = createHash('sha256').update(initial.sessionToken).digest('hex');
    const persisted = await db.authSession.findUniqueOrThrow({ where: { tokenHash } });
    assert.equal(persisted.userId, userId);
    assert.equal(persisted.expiresAt.toISOString(), initial.expiresAt);
    assert.notEqual(persisted.tokenHash, initial.sessionToken);

    const headers = { authorization: `Bearer ${initial.sessionToken}` };
    const profile = () => app.inject({ method: 'GET', url: '/api/v1/me', headers });
    const patch = (payload: Record<string, unknown>) =>
      app.inject({ method: 'PATCH', url: '/api/v1/me', headers, payload });

    assert.deepEqual((await profile()).json(), initial.user);
    assert.equal((await patch({ timezone: '+02:00' })).statusCode, 400);
    assert.equal((await patch({ name: 'Nome forjado' })).statusCode, 400);
    assert.equal((await patch({})).statusCode, 400);

    const other = await login({ sub: otherSub });
    assert.equal(other.statusCode, 200, other.body);
    assert.notEqual(other.json().user.id, userId);

    const team = await db.team.create({
      data: {
        userId: other.json().user.id,
        name: 'Ajax',
        sport: 'Futsal',
        category: 'Sub-11',
      },
    });
    assert.equal(
      (await patch({ timezone: 'America/Recife', activeTeamId: team.id })).statusCode,
      404,
    );
    assert.equal((await profile()).json().timezone, 'America/Sao_Paulo');

    await db.teamFollow.create({ data: { userId, teamId: team.id } });
    const updated = await patch({ timezone: 'America/Recife', activeTeamId: team.id });
    assert.equal(updated.statusCode, 200, updated.body);

    const returning = await login({
      name: 'Treinador atualizado',
      email: 'novo@example.com',
    });
    assert.equal(returning.statusCode, 200, returning.body);
    assert.deepEqual(returning.json().user, {
      id: userId,
      name: 'Treinador atualizado',
      email: 'novo@example.com',
      timezone: 'America/Recife',
      activeTeamId: team.id,
    });

    await db.team.delete({ where: { id: team.id } });
    assert.equal((await profile()).json().activeTeamId, null);

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers,
    });
    assert.equal(logout.statusCode, 204);
    assert.equal((await profile()).statusCode, 401);

    const secondHeaders = { authorization: `Bearer ${secondSession.sessionToken}` };
    const secondProfile = () =>
      app.inject({ method: 'GET', url: '/api/v1/me', headers: secondHeaders });
    assert.equal((await secondProfile()).statusCode, 200);
    await db.authSession.update({
      where: {
        tokenHash: createHash('sha256').update(secondSession.sessionToken).digest('hex'),
      },
      data: { expiresAt: new Date(0) },
    });
    assert.equal((await secondProfile()).statusCode, 401);
  },
);

test('sessão web usa cookie HttpOnly e bloqueia escritas de outra origem', async (t) => {
  const origin = 'https://agenda.example.com';
  const user = { id: randomUUID(), name: 'Treinador', email: 'treinador@example.com' };
  let expiresAt: Date;
  let sessionHash: string;
  let revoked = false;
  const db = {
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
      user: { upsert: async () => user },
      authSession: {
        create: async ({ data }: { data: { expiresAt: Date; tokenHash: string } }) => {
          expiresAt = data.expiresAt;
          sessionHash = data.tokenHash;
        },
      },
    }),
    authSession: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        !revoked && where.tokenHash === sessionHash ? { id: 'session', user, expiresAt } : null,
      updateMany: async () => { revoked = true; },
    },
  };
  const app = buildApp({
    db: db as unknown as Parameters<typeof buildApp>[0]['db'],
    sessionTtlHours: 168,
    webSessionOrigin: origin,
    verifyGoogleIdentity: async () => ({ sub: 'google-id', email: user.email, name: user.name }),
  });
  t.after(() => app.close());
  const login = (requestOrigin: string) => app.inject({
    method: 'POST', url: '/api/v1/auth/google', headers: { origin: requestOrigin },
    payload: { idToken: 'test-credential', webSession: 'cookie' },
  });
  assert.equal((await login('https://other.example.com')).statusCode, 403);
  const response = await login(origin);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().sessionToken, undefined);
  assert.ok(Date.parse(response.json().expiresAt) - Date.now() <= 8 * 60 * 60 * 1000);
  const setCookie = response.headers['set-cookie'];
  assert.ok(typeof setCookie === 'string');
  assert.match(setCookie, /^__Host-agenda-session=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Strict;/);
  const cookie = setCookie.split(';')[0]!;
  const restore = await app.inject({ url: '/api/v1/auth/web/session', headers: { cookie } });
  assert.equal(restore.statusCode, 200);
  assert.equal(restore.json().sessionToken, undefined);
  const logout = (requestOrigin?: string) => app.inject({
    method: 'POST', url: '/api/v1/auth/logout',
    headers: { cookie, ...(requestOrigin && { origin: requestOrigin }) },
  });
  assert.equal((await logout()).statusCode, 403);
  assert.equal((await logout('https://other.example.com')).statusCode, 403);
  const ended = await logout(origin);
  assert.equal(ended.statusCode, 204);
  assert.match(String(ended.headers['set-cookie']), /Max-Age=0/);
  assert.equal((await app.inject({ url: '/api/v1/auth/web/session', headers: { cookie } })).statusCode, 401);
});
