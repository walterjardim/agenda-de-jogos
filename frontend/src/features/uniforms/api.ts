import { request } from '../auth/api';
import type { UniformPiece } from '../matches/model';

export type UniformInput = Omit<UniformPiece, 'id'>;
export function saveUniform(
  token: string,
  teamId: string,
  input: UniformInput,
  id?: string,
): Promise<UniformPiece> {
  const { pieceType, ...changes } = input;
  return request(
    id
      ? `/uniforms/${encodeURIComponent(id)}`
      : `/teams/${encodeURIComponent(teamId)}/uniforms`,
    {
      token,
      method: id ? 'PATCH' : 'POST',
      body: id ? changes : { ...changes, pieceType },
    },
  );
}
export function deleteUniform(token: string, id: string): Promise<void> {
  return request(`/uniforms/${encodeURIComponent(id)}`, {
    token,
    method: 'DELETE',
  });
}
