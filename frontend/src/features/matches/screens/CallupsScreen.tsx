import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDiscardChanges } from '../../../shared/components/useDiscardChanges';
import { theme } from '../../../shared/theme/theme';
import { ApiError } from '../../auth/api';
import { useAuth } from '../../auth/AuthContext';
import { ActionButton } from '../../../shared/components/ActionButton';
import { HomeScreen } from '../../home/components/HomeScreen';
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
  returnToPreview,
}: {
  match: MatchDetail;
  roster: Athlete[];
  token: string | null;
  returnToPreview?: () => void;
}) {
  const router = useRouter();
  const { changePreviewMatch } = usePreview();
  const { invalidateSession } = useAuth();
  const [baseline, setBaseline] = useState(() => {
    const saved = match.callups ?? [];
    const hasSavedCallup = match.hasSavedCallup ?? saved.length > 0;
    return new Set(
      hasSavedCallup
        ? saved.map(({ athleteId }) => athleteId)
        : roster.map(({ id }) => id),
    );
  });
  const [selected, setSelected] = useState(baseline);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const { allowExit, confirmation } = useDiscardChanges(
    selected.size !== baseline.size ||
      [...selected].some((id) => !baseline.has(id)),
    busy,
  );
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
      setBaseline(selected);
      if (share) {
        router.push({
          pathname: '/compartilhar/[id]',
          params: { id: match.id, type: 'callup' },
        });
      } else {
        allowExit();
        if (returnToPreview) returnToPreview();
        else router.dismissTo(sheet);
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
      <View style={[styles.card, styles.highlighted]}>
        <Text accessibilityLiveRegion="polite" style={styles.title}>
          {count} {count === 1 ? 'convocado' : 'convocados'}
        </Text>
        <Text style={styles.text}>
          Total estimado ·{' '}
          {total === null ? 'Taxa não informada' : formatFee(total)}
        </Text>
      </View>
      {roster.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.text}>Nenhum atleta cadastrado no elenco.</Text>
          <ActionButton
            label="Abrir elenco"
            onPress={() => router.push('/elenco')}
          />
        </View>
      )}
      {roster.map(({ id, name, shirtNumber, position, status }) => (
        <View
          style={[styles.card, selected.has(id) && styles.highlighted]}
          key={id}
        >
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`${shirtNumber} · ${name} · ${position}${status === 'active' ? '' : status === 'injured' ? ' · Lesão' : ' · Suspensão'}`}
            aria-checked={selected.has(id)}
            accessibilityState={{ checked: selected.has(id), disabled: busy }}
            disabled={busy}
            onPress={() => toggle(id)}
            style={({ pressed }) => [
              rosterStyles.row,
              (pressed || busy) && rosterStyles.dimmed,
            ]}
          >
            <View
              aria-hidden
              style={[
                rosterStyles.checkbox,
                selected.has(id) && rosterStyles.checked,
              ]}
            >
              {selected.has(id) && <Text style={rosterStyles.check}>✓</Text>}
            </View>
            <View style={rosterStyles.player}>
              <Text style={styles.label}>
                {shirtNumber} · {name}
              </Text>
              <Text style={styles.text}>{position}</Text>
            </View>
          </Pressable>
          {status !== 'active' && (
            <Text style={styles.error}>
              {name} · {status === 'injured' ? 'Lesão' : 'Suspensão'}
            </Text>
          )}
        </View>
      ))}
      {confirmation}
      {Boolean(error) && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={styles.actions}>
        <ActionButton
          icon="save"
          label={busy ? 'Salvando…' : 'Salvar convocação'}
          primary
          fullWidth
          disabled={busy}
          onPress={() => void submit(false)}
        />
        {!returnToPreview && (
          <ActionButton
            icon="share"
            label="Compartilhar convocação"
            fullWidth
            disabled={busy || count === 0}
            onPress={() => void submit(true)}
          />
        )}
      </View>
    </>
  );
}

function Callups({
  id,
  team,
  fromPreview,
}: {
  id: string;
  team: AgendaTeam;
  fromPreview: boolean;
}) {
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

  function returnToPreview() {
    if (router.canGoBack()) router.back();
    else
      router.replace({
        pathname: '/compartilhar/[id]',
        params: { id, type: 'callup', from: 'agenda' },
      });
  }

  return (
    <HomeScreen
      title="Convocação"
      description={data?.match.opponent}
      standalone
      compactHeader
      onBack={
        fromPreview
          ? returnToPreview
          : () => router.dismissTo({ pathname: '/jogo/[id]', params: { id } })
      }
    >
      {state.status === 'loading' && <LoadingMatches />}
      {state.status === 'error' && (
        <MatchLoadError error={state.error} retry={retry} />
      )}
      {state.status === 'ready' && !data && (
        <Text style={styles.text}>Jogo indisponível.</Text>
      )}
      {data && (
        <Selection
          {...data}
          token={token}
          returnToPreview={fromPreview ? returnToPreview : undefined}
        />
      )}
    </HomeScreen>
  );
}

export function CallupsScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: 'preview' }>();
  const team = useAgendaTeam();
  if (!team || !id) return <Redirect href="/buscar" />;
  return (
    <Callups
      fromPreview={from === 'preview'}
      key={`${id}:${team.id}`}
      id={id}
      team={team}
    />
  );
}

const rosterStyles = StyleSheet.create({
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dimmed: { opacity: 0.65 },
  player: { flex: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  check: { color: theme.colors.white, fontWeight: '800' },
});
