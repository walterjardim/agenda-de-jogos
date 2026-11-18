import { request } from '../auth/api';
import type { Athlete, Competition } from '../matches/model';

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
