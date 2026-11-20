import { request } from '../auth/api';
import type { Athlete, Competition } from '../matches/model';

export type TeamInput = { name: string; sport: string; category: string };
export type Team = TeamInput & { id: string; createdAt: string };
export type TeamSummary = TeamInput & {
  id: string;
  isOwner: boolean;
  isFollowing: boolean;
  athletesCount?: number;
  nextMatchAt?: string | null;
};
export type TeamPage = {
  data: TeamSummary[];
  nextCursor: string | null;
};

export function searchTeams(
  token: string,
  q: string,
  mine: boolean,
  cursor?: string,
): Promise<TeamPage> {
  if (!mine && q.trim().length < 2)
    return Promise.resolve({ data: [], nextCursor: null });
  const query = new URLSearchParams({ q });
  if (mine) query.set('mine', 'true');
  if (cursor) query.set('cursor', cursor);
  return request(`${mine ? '/teams' : '/teams/search'}?${query}`, { token });
}

export async function listMyTeams(token: string): Promise<TeamSummary[]> {
  const teams: TeamSummary[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await searchTeams(token, '', true, cursor);
    teams.push(...page.data);
    cursor = page.nextCursor ?? undefined;
    if (cursor && cursors.has(cursor))
      throw new Error('Cursor repetido na API.');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return teams.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function followTeam(
  token: string,
  id: string,
): Promise<{ teamId: string; isFollowing: boolean }> {
  return request(`/teams/${encodeURIComponent(id)}/follow`, {
    token,
    method: 'PUT',
  });
}

export function unfollowTeam(token: string, id: string): Promise<void> {
  return request(`/teams/${encodeURIComponent(id)}/follow`, {
    token,
    method: 'DELETE',
  });
}

export function listOwnedTeams(token: string): Promise<Team[]> {
  return request('/me/teams', { token });
}

export function saveTeam(
  token: string,
  body: TeamInput,
  id?: string,
): Promise<Team> {
  return request(id ? `/teams/${encodeURIComponent(id)}` : '/teams', {
    method: id ? 'PATCH' : 'POST',
    token,
    body,
  });
}

export function deleteTeam(token: string, id: string): Promise<void> {
  return request(`/teams/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  });
}

export type RecordKind = 'athletes' | 'competitions';
export type RecordInput = Omit<Athlete, 'id'> | Omit<Competition, 'id'>;

export function createTeamRecord(
  kind: RecordKind,
  teamId: string,
  token: string,
  body: RecordInput,
) {
  return request(`/teams/${encodeURIComponent(teamId)}/${kind}`, {
    method: 'POST',
    token,
    body,
  });
}

export function updateTeamRecord(
  kind: RecordKind,
  id: string,
  token: string,
  body: Partial<RecordInput>,
) {
  return request(`/${kind}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body,
  });
}

export function deleteTeamRecord(kind: RecordKind, id: string, token: string) {
  return request(`/${kind}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  });
}
