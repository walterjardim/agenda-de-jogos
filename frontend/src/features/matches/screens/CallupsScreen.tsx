import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ApiError } from '../../auth/api';
import { useAuth } from '../../auth/AuthContext';
import { ActionButton, HomeScreen } from '../../home/components/HomeScreen';
import { usePreview } from '../../home/PreviewContext';
import { fetchAthletes, saveCallups } from '../api';
import {
  LoadingMatches,
  MatchLoadError,
  styles,
} from '../components/MatchViews';
import {
  type AgendaTeam,
  useAgendaTeam,
  useMatchLoader,
  useMatchResource,
} from '../hooks';
import { type Athlete, formatFee, type MatchDetail } from '../model';

function Selection({
  match,
  roster,
  token,
}: {
  match: MatchDetail;
  roster: Athlete[];
  token: string | null;
}) {
  const router = useRouter();
  const { changePreviewMatch } = usePreview();
  const { invalidateSession } = useAuth();
  const [selected, setSelected] = useState(() => {
    const saved = match.callups ?? [];
    const hasSavedCallup = match.hasSavedCallup ?? saved.length > 0;
    return new Set(
      hasSavedCallup
        ? saved.map(({ athleteId }) => athleteId)
        : roster.map(({ id }) => id),
    );
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const athletes = roster.filter(({ id }) => selected.has(id));
  const count = athletes.length;
  const total =
    match.refereeFeeCents === null ? null : match.refereeFeeCents * count;
  const sheet = { pathname: '/jogo/[id]' as const, params: { id: match.id } };

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(share: boolean) {
    if (pending.current || (share && count === 0)) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (token) {
        await saveCallups(
          match.id,
          token,
          athletes.map(({ id }) => id),
        );
      } else {
        const callups = athletes.map(({ id, name, shirtNumber, position }) => ({
          athleteId: id,
          name,
          shirtNumber,
          position,
        }));
        changePreviewMatch(match.id, (current) => ({
          ...current,
          callups,
          callupsCount: count,
          hasSavedCallup: true,
        }));
      }
      if (share) {
        router.push({
          pathname: '/compartilhar/[id]',
          params: { id: match.id, type: 'callup' },
        });
      } else {
        router.dismissTo(sheet);
      }
    } catch (error) {
      if (token && error instanceof ApiError && error.status === 401) {
        await invalidateSession(token);
      } else {
        setError(
          'Não foi possível salvar a convocação. Confira a conexão e tente novamente.',
        );
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Text accessibilityLiveRegion="polite" style={styles.title}>
        {count} {count === 1 ? 'convocado' : 'convocados'}
      </Text>
      {roster.length === 0 && (
        <Text style={styles.text}>Nenhum atleta cadastrado no elenco.</Text>
      )}
      {roster.map(({ id, name, shirtNumber, position, status }) => (
        <View style={styles.card} key={id}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`${shirtNumber} · ${name} · ${position}`}
            aria-checked={selected.has(id)}
            accessibilityState={{ checked: selected.has(id), disabled: busy }}
            disabled={busy}
            onPress={() => toggle(id)}
            style={styles.option}
          >
            <Text style={styles.label}>
              {selected.has(id) ? '☑' : '☐'} {shirtNumber} · {name} · {position}
            </Text>
          </Pressable>
          {status !== 'active' && (
            <Text style={styles.error}>
              {name} · {status === 'injured' ? 'Lesão' : 'Suspensão'}
            </Text>
          )}
        </View>
      ))}
      <Text style={styles.label}>
        Total estimado ·{' '}
        {total === null ? 'Taxa não informada' : formatFee(total)}
      </Text>
      {Boolean(error) && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
      <ActionButton
        label={busy ? 'Salvando…' : 'Salvar convocação'}
        primary
        disabled={busy}
        onPress={() => void submit(false)}
      />
      <ActionButton
        label="Compartilhar convocação"
        disabled={busy || count === 0}
        onPress={() => void submit(true)}
      />
      <ActionButton
        label="Voltar à ficha"
        disabled={busy}
        onPress={() => router.dismissTo(sheet)}
      />
    </>
  );
}

function Callups({ id, team }: { id: string; team: AgendaTeam }) {
  const router = useRouter();
  const loadMatch = useMatchLoader(id, team);
  const { previewAthletes } = usePreview();
  const { token, id: teamId } = team;
  const load = useCallback(async () => {
    const [match, roster] = await Promise.all([
      loadMatch(),
      token ? fetchAthletes(teamId, token) : previewAthletes,
    ]);
    return match
      ? {
          match,
          roster: [...roster].sort((a, b) => a.shirtNumber - b.shirtNumber),
        }
      : null;
  }, [loadMatch, token, teamId, previewAthletes]);
  const { state, retry } = useMatchResource(load);
  const data = state.status === 'ready' ? state.data : null;

  return (
    <HomeScreen
      title="Convocação"
      description={data?.match.opponent}
      standalone
    >
      {state.status === 'loading' && <LoadingMatches />}
      {state.status === 'error' && (
        <MatchLoadError error={state.error} retry={retry} />
      )}
      {state.status === 'ready' && !data && (
        <Text style={styles.text}>Jogo indisponível.</Text>
      )}
      {data ? (
        <Selection {...data} token={token} />
      ) : (
        <ActionButton
          label="Voltar à ficha"
          onPress={() =>
            router.dismissTo({ pathname: '/jogo/[id]', params: { id } })
          }
        />
      )}
    </HomeScreen>
  );
}

export function CallupsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const team = useAgendaTeam();
  if (!team || !id) return <Redirect href="/buscar" />;
  return <Callups key={`${id}:${team.id}`} id={id} team={team} />;
}
