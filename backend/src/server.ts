import 'dotenv/config';
import { buildApp } from './app.js';
import { createGoogleVerifier } from './auth/google.js';
import { loadConfig } from './config.js';
import { createDatabase } from './database.js';

async function start() {
  const config = loadConfig(process.env);
  const db = createDatabase(config.DATABASE_URL);
  const app = buildApp({
    db,
    verifyGoogleIdentity: createGoogleVerifier(config.GOOGLE_CLIENT_IDS),
    sessionTtlHours: config.SESSION_TTL_HOURS,
    logger: true,
    corsOrigins: config.CORS_ORIGINS,
    webSessionOrigin: config.WEB_SESSION_ORIGIN,
  });

  app.addHook('onClose', () => db.$disconnect());

  async function close() {
    try {
      await app.close();
    } catch {
      app.log.error('Não foi possível encerrar a API corretamente.');
      process.exitCode = 1;
    }
  }

  try {
    await db.$queryRaw`SELECT 1`;
    await app.listen({ host: config.HOST, port: config.PORT });
  } catch {
    app.log.error(
      'Não foi possível iniciar a API. Confira a conexão com o banco e a porta configurada.',
    );
    process.exitCode = 1;
    await close();
    return;
  }

  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

start().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
