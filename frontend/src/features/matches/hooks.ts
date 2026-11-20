import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { usePreview } from '../home/PreviewContext';
import { fetchMatch } from './api';
import { previewTeam, previewTimezone } from './preview';

export function useAgendaTeam() {
  const { session } = useAuth();
  const { selectedPreviewTeam } = usePreview();

  if (session) {
    const { activeTeamId, timezone } = session.user;
    return activeTeamId
      ? { id: activeTeamId, timezone, token: session.sessionToken }
      : null;
  }
  return selectedPreviewTeam
    ? { id: previewTeam.id, timezone: previewTimezone, token: null }
    : null;
}

export type AgendaTeam = NonNullable<ReturnType<typeof useAgendaTeam>>;

export function useMatchLoader(
  id: string | undefined,
  { id: teamId, token }: AgendaTeam,
) {
  const { previewMatches } = usePreview();
  const preview =
    id && !token ? previewMatches.find((item) => item.id === id) : undefined;

  return useCallback(async () => {
    if (!id) return null;
    const match = token ? await fetchMatch(id, token) : preview;
    return match?.teamId === teamId ? match : null;
  }, [id, preview, teamId, token]);
}

type Resource<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: T };

export function useMatchResource<T>(load: () => Promise<T>) {
  const focused = useIsFocused();
  const { invalidateSession, refreshProfile, session } = useAuth();
  const token = session?.sessionToken;
  const [state, setState] = useState<Resource<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!focused) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setState({ status: 'loading' });
      try {
        const data = await load();
        if (active) setState({ status: 'ready', data });
      } catch (error) {
        if (!active) return;
        if (token && error instanceof ApiError && error.status === 401) {
          void invalidateSession(token);
        }
        if (token && error instanceof ApiError && error.status === 404) {
          await refreshProfile(token).catch(() => undefined);
        }
        if (active) setState({ status: 'error', error });
      }
    });
    return () => {
      active = false;
    };
  }, [focused, load, token, invalidateSession, refreshProfile, attempt]);

  return { state, retry: () => setAttempt((value) => value + 1) };
}
