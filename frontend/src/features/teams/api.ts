import { request } from '../auth/api';
import type { Athlete, Competition } from '../matches/model';

export type TeamInput = { name: string; sport: string; category: string };
export type Team = TeamInput & { id: string; createdAt: string };
export type TeamPage = {
  data: (Team & { isOwner: boolean })[];
  nextCursor: string | null;
};

export function searchTeams(
  token: string,
  q: string,
  mine: boolean,
  cursor?: string,
): Promise<TeamPage> {
  const query = new URLSearchParams({ q, mine: String(mine) });
  if (cursor) query.set('cursor', cursor);
  return request(`/teams?${query}`, { token });
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
