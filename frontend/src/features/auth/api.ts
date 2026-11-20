import { apiUrl, loginSetupMessage } from './config';

export type Profile = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  activeTeamId: string | null;
};

export type Session = { sessionToken: string; expiresAt: string };
export type AuthenticatedSession = Session & { user: Profile };

export class ApiError extends Error {
  constructor(readonly status: number) {
    super('Falha na requisição à API.');
  }
}

export async function request(
  path: string,
  {
    method = 'GET',
    token,
    body,
  }: { method?: string; token?: string; body?: object } = {},
) {
  if (!apiUrl) {
    throw new Error(loginSetupMessage);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(apiUrl + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(response.status);
    return response.status === 204 ? undefined : await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Partial<Session>;
  return (
    typeof session.sessionToken === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(session.sessionToken) &&
    typeof session.expiresAt === 'string' &&
    Number.isFinite(Date.parse(session.expiresAt))
  );
}

function profile(value: unknown): Profile {
  const user = value as Partial<Profile> | null;
  if (
    !user ||
    typeof user.id !== 'string' ||
    typeof user.name !== 'string' ||
    typeof user.email !== 'string' ||
    typeof user.timezone !== 'string' ||
    (user.activeTeamId !== null && typeof user.activeTeamId !== 'string')
  ) {
    throw new Error('A API retornou um perfil inválido.');
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    activeTeamId: user.activeTeamId,
  };
}

export async function loginWithGoogle(
  idToken: string,
): Promise<AuthenticatedSession> {
  const result: unknown = await request('/auth/google', {
    method: 'POST',
    body: { idToken },
  });
  if (
    !isSession(result) ||
    !('user' in result) ||
    Date.parse(result.expiresAt) <= Date.now()
  ) {
    throw new Error('A API retornou uma sessão inválida.');
  }
  return {
    sessionToken: result.sessionToken,
    expiresAt: result.expiresAt,
    user: profile(result.user),
  };
}

export async function getProfile(token: string) {
  return profile(await request('/me', { token }));
}

export async function updateTimezone(token: string, timezone: string) {
  return profile(
    await request('/me', { method: 'PATCH', token, body: { timezone } }),
  );
}

export async function revokeSession(token: string) {
  await request('/auth/logout', { method: 'POST', token });
}

export async function selectTeam(token: string, id: string) {
  return profile(
    await request('/me', {
      method: 'PATCH',
      token,
      body: { activeTeamId: id },
    }),
  );
}
