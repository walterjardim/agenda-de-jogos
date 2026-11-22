import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  GOOGLE_CLIENT_IDS: z
    .string()
    .transform((value) => value.split(',').map((id) => id.trim()))
    .pipe(
      z.array(z.string().regex(/^[a-z0-9-]+\.apps\.googleusercontent\.com$/i)).min(1),
    ),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(
      z.array(
        z.url({ protocol: /^https?$/ }).refine((value) => {
          try {
            return new URL(value).origin === value;
          } catch {
            return false;
          }
        }),
      ),
    ),
  WEB_SESSION_ORIGIN: z.url({ protocol: /^https$/ }).refine((value) => new URL(value).origin === value).optional(),
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
});

export function loadConfig(env: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => issue.path[0]))];
    throw new Error(`Variáveis de ambiente ausentes ou inválidas: ${keys.join(', ')}`);
  }
  return result.data;
}
