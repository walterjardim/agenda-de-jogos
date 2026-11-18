import { request } from '../auth/api';
import type {
  Athlete,
  Catalog,
  Competition,
  Match,
  MatchInput,
  MatchDetail,
  MessageType,
  Team,
  UniformPiece,
} from './model';

type Page<T> = { data: T[]; nextCursor: string | null };

async function readList<T>(
  path: string,
  token: string,
  filters = new URLSearchParams(),
) {
  const values: T[] = [];
  const query = new URLSearchParams(filters);
  let cursor: string | null;
  const cursors = new Set<string>();

  do {
    const page: Page<T> = await request(`${path}?${query}`, { token });
    values.push(...page.data);
    cursor = page.nextCursor;
    if (cursor) {
      if (cursors.has(cursor)) throw new Error('Cursor repetido na API.');
      cursors.add(cursor);
      query.set('cursor', cursor);
    }
  } while (cursor);
  return values;
}

function teamPath(teamId: string) {
  return `/teams/${encodeURIComponent(teamId)}`;
}

export async function fetchTeam(teamId: string, token: string) {
  return request(teamPath(teamId), { token }) as Promise<Team>;
}

export function fetchWeek(
  teamId: string,
  token: string,
  from: string,
  to: string,
) {
  return readList<Match>(
    `${teamPath(teamId)}/matches`,
    token,
    new URLSearchParams({ from, to }),
  );
}

export async function fetchCatalog(
  teamId: string,
  token: string,
): Promise<Catalog> {
  const base = teamPath(teamId);
  const [competitions, uniforms] = await Promise.all([
    fetchCompetitions(teamId, token),
    readList<UniformPiece>(`${base}/uniforms`, token),
  ]);
  return { competitions, uniforms };
}

export async function createMatch(
  teamId: string,
  token: string,
  body: MatchInput,
): Promise<Match> {
  return request(`${teamPath(teamId)}/matches`, {
    method: 'POST',
    token,
    body,
  });
}

function matchPath(id: string) {
  return `/matches/${encodeURIComponent(id)}`;
}

export async function fetchMatch(
  id: string,
  token: string,
): Promise<MatchDetail> {
  return request(matchPath(id), { token });
}

export function updateMatch(
  id: string,
  token: string,
  body: Partial<MatchInput>,
) {
  return request(matchPath(id), { method: 'PATCH', token, body });
}

export function deleteMatch(id: string, token: string) {
  return request(matchPath(id), { method: 'DELETE', token });
}

export function fetchAthletes(teamId: string, token: string) {
  return readList<Athlete>(`${teamPath(teamId)}/athletes`, token);
}

export function fetchCompetitions(teamId: string, token: string) {
  return readList<Competition>(`${teamPath(teamId)}/competitions`, token);
}

export function saveCallups(id: string, token: string, athleteIds: string[]) {
  return request(`${matchPath(id)}/callups`, {
    method: 'PUT',
    token,
    body: { athleteIds },
  });
}

export async function fetchMessage(
  id: string,
  token: string,
  type: MessageType,
): Promise<{ text: string; whatsappUrl: string | null }> {
  return request(`${matchPath(id)}/message?type=${type}`, { token });
}
