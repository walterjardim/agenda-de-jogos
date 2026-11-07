import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (parsed.success) {
    return parsed.data;
  }

  const fields = Object.fromEntries(
    parsed.error.issues.map((issue) => [issue.path.join('.') || 'body', issue.message]),
  );
  throw new ApiError(400, 'VALIDATION_ERROR', 'Campo inválido', fields);
}

export function registerErrors(app: FastifyInstance) {
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({
      error: { code: 'NOT_FOUND', message: 'Recurso não encontrado' },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, fields: error.fields },
      });
    }

    if (
      error instanceof Error &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      return reply.code(error.statusCode).send({
        error: { code: 'VALIDATION_ERROR', message: 'Requisição inválida' },
      });
    }

    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorCode =
      error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;
    request.log.error({ errorName, errorCode }, 'Erro interno da API');
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno da API' },
    });
  });
}
