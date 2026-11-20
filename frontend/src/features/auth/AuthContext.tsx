import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ApiError,
  type AuthenticatedSession,
  getProfile,
  isSession,
  loginWithGoogle,
  revokeSession,
  updateTimezone,
  selectTeam,
} from './api';
import { apiUrl } from './config';
import { signOutGoogle } from './googleSession';
import { sessionStorage } from './sessionStorage';

type Auth = {
  session: AuthenticatedSession | null;
  restoring: boolean;
  restoreFailed: boolean;
  retryRestore: () => void;
  invalidateSession: (token: string) => Promise<void>;
  signIn: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveTimezone: (timezone: string) => Promise<void>;
  clearDeletedTeam: (token: string, teamId: string) => void;
  chooseTeam: (id: string) => Promise<void>;
  refreshProfile: (token: string) => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

async function clearStoredSession() {
  // A sessão expirada ou revogada pode ser descartada mesmo se o armazenamento estiver indisponível.
  await sessionStorage.clear().catch(() => undefined);
}

async function restoreSession(): Promise<AuthenticatedSession | null> {
  if (!apiUrl) return null;
  const raw = await sessionStorage.read();
  if (!raw) return null;

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    stored = null;
  }
  if (
    !isSession(stored) ||
    !('apiUrl' in stored) ||
    stored.apiUrl !== apiUrl ||
    Date.parse(stored.expiresAt) <= Date.now()
  ) {
    await clearStoredSession();
    return null;
  }

  try {
    const user = await getProfile(stored.sessionToken);
    return {
      sessionToken: stored.sessionToken,
      expiresAt: stored.expiresAt,
      user,
    };
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error;
    await clearStoredSession();
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthenticatedSession | null>(null);
  const [restoreState, setRestoreState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [attempt, setAttempt] = useState(0);
  const activeToken = useRef<string | null>(null);
  const choosingTeam = useRef(false);
  const profileRevision = useRef(0);

  useEffect(() => {
    let active = true;
    restoreSession().then(
      (value) => {
        if (!active) return;
        activeToken.current = value?.sessionToken ?? null;
        setSession(value);
        setRestoreState('ready');
      },
      () => {
        if (active) setRestoreState('error');
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const retryRestore = () => {
    setRestoreState('loading');
    setAttempt((value) => value + 1);
  };

  const endSession = useCallback(
    async (token: string, disconnectGoogle = false) => {
      if (activeToken.current !== token) return;
      activeToken.current = null;
      if (disconnectGoogle) await signOutGoogle().catch(() => undefined);
      await clearStoredSession();
      setSession(null);
    },
    [],
  );

  const expiresAt = session?.expiresAt;
  const sessionToken = session?.sessionToken;
  useEffect(() => {
    if (!expiresAt || !sessionToken) return;
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiry = () => {
      const remaining = Date.parse(expiresAt) - Date.now();
      if (remaining <= 0) {
        void endSession(sessionToken);
      } else {
        timer = setTimeout(checkExpiry, Math.min(remaining, 2147483647));
      }
    };
    checkExpiry();
    return () => clearTimeout(timer);
  }, [endSession, expiresAt, sessionToken]);

  const signIn = useCallback(async (idToken: string) => {
    const next = await loginWithGoogle(idToken);
    try {
      await sessionStorage.write(
        JSON.stringify({
          apiUrl,
          sessionToken: next.sessionToken,
          expiresAt: next.expiresAt,
        }),
      );
    } catch {
      await revokeSession(next.sessionToken).catch(() => undefined);
      throw new Error('Não foi possível guardar a sessão.');
    }
    activeToken.current = next.sessionToken;
    setSession(next);
  }, []);

  const signOut = async () => {
    if (!session) return;
    try {
      await revokeSession(session.sessionToken);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    await endSession(session.sessionToken, true);
  };

  const saveTimezone = async (timezone: string) => {
    if (!session) return;
    try {
      const user = await updateTimezone(session.sessionToken, timezone);
      setSession((current) =>
        current?.sessionToken === session.sessionToken
          ? { ...current, user: { ...current.user, timezone: user.timezone } }
          : current,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await endSession(session.sessionToken);
      }
      throw error;
    }
  };

  const chooseTeam = async (id: string) => {
    if (!session || choosingTeam.current)
      throw new Error('Seleção indisponível.');
    choosingTeam.current = true;
    const revision = ++profileRevision.current;
    try {
      const user = await selectTeam(session.sessionToken, id);
      if (
        activeToken.current !== session.sessionToken ||
        revision !== profileRevision.current
      )
        throw new Error('Seleção ou sessão alterada.');
      setSession((current) =>
        current?.sessionToken === session.sessionToken
          ? {
              ...current,
              user: { ...current.user, activeTeamId: user.activeTeamId },
            }
          : current,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        await endSession(session.sessionToken);
      throw error;
    } finally {
      choosingTeam.current = false;
    }
  };

  const refreshProfile = useCallback(
    async (token: string) => {
      const revision = profileRevision.current;
      try {
        const user = await getProfile(token);
        setSession((current) =>
          current?.sessionToken === token &&
          profileRevision.current === revision &&
          current.user.activeTeamId !== user.activeTeamId
            ? {
                ...current,
                user: { ...current.user, activeTeamId: user.activeTeamId },
              }
            : current,
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 401)
          await endSession(token);
        throw error;
      }
    },
    [endSession],
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        restoring: restoreState === 'loading',
        restoreFailed: restoreState === 'error',
        retryRestore,
        invalidateSession: endSession,
        signIn,
        signOut,
        saveTimezone,
        chooseTeam,
        refreshProfile,
        clearDeletedTeam: (token, teamId) => {
          profileRevision.current += 1;
          setSession((current) =>
            current?.sessionToken === token &&
            current.user.activeTeamId === teamId
              ? { ...current, user: { ...current.user, activeTeamId: null } }
              : current,
          );
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider ausente.');
  return auth;
}
