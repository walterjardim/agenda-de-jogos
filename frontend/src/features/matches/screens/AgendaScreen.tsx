import { Redirect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { ActionButton, HomeScreen } from '../../home/components/HomeScreen';
import { usePreview } from '../../home/PreviewContext';
import { fetchTeam, fetchWeek } from '../api';
import {
  LoadingMatches,
  MatchLoadError,
  styles,
} from '../components/MatchViews';
import { type AgendaTeam, useAgendaTeam, useMatchResource } from '../hooks';
import { formatGameTime, gamesInWeek, weekInTimezone } from '../model';
import { previewTeam } from '../preview';

function WeeklyAgenda({ id, timezone, token }: AgendaTeam) {
  const router = useRouter();
  const { previewMatches } = usePreview();
  const loadTeam = useCallback(
    async () => (token ? fetchTeam(id, token) : previewTeam),
    [id, token],
  );
  const teamResource = useMatchResource(loadTeam);
  const selectedTeam =
    teamResource.state.status === 'ready' ? teamResource.state.data : null;
  const load = useCallback(async () => {
    const week = weekInTimezone(timezone);
    const matches = token
      ? await fetchWeek(id, token, week.from, week.to)
      : previewMatches;
    return { week, matches: gamesInWeek(matches, week, timezone) };
  }, [id, previewMatches, timezone, token]);
  const { state, retry } = useMatchResource(load);
  const data = state.status === 'ready' ? state.data : null;

  return (
    <HomeScreen
      title="Agenda da semana"
      description={
        selectedTeam
          ? `${selectedTeam.name} · ${selectedTeam.category}`
          : undefined
      }
    >
      <Text style={styles.text}>
        {(data?.week ?? weekInTimezone(timezone)).label}
      </Text>
      <View style={styles.row}>
        {(!token || selectedTeam?.isOwner) && (
          <ActionButton
            label="Novo jogo"
            primary
            onPress={() => router.push('/novo-jogo')}
          />
        )}
        <ActionButton
          label="Trocar time"
          onPress={() =>
            router.navigate(token ? '/trocar-time' : '/meus-times')
          }
        />
      </View>
      {(!token || selectedTeam?.isOwner) && (
        <View style={styles.row}>
          <ActionButton label="Elenco" onPress={() => router.push('/elenco')} />
          <ActionButton
            label="Competições"
            onPress={() => router.push('/competicoes')}
          />
        </View>
      )}
      {teamResource.state.status === 'loading' && (
        <Text style={styles.text}>Carregando time escolhido…</Text>
      )}
      {teamResource.state.status === 'error' && (
        <>
          <Text style={styles.text}>
            Não foi possível carregar o time escolhido. Tente novamente ou
            troque de time.
          </Text>
          <ActionButton label="Recarregar time" onPress={teamResource.retry} />
        </>
      )}
      {state.status === 'loading' && <LoadingMatches />}
      {state.status === 'error' && (
        <MatchLoadError error={state.error} retry={retry} />
      )}
      {data?.matches.length === 0 && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          Nenhum jogo nesta semana.
        </Text>
      )}
      {data?.matches.map((match) => (
        <View key={match.id} style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {selectedTeam?.name ?? 'Time'} × {match.opponent}
          </Text>
          <Text style={styles.label}>
            Jogo · {formatGameTime(match.startsAt, timezone)}
          </Text>
          <Text style={styles.text}>
            Chegada · {formatGameTime(match.arrivalAt, timezone)}
          </Text>
          <ActionButton
            label="Ver ficha"
            onPress={() =>
              router.push({ pathname: '/jogo/[id]', params: { id: match.id } })
            }
          />
        </View>
      ))}
    </HomeScreen>
  );
}

export function AgendaScreen() {
  const team = useAgendaTeam();
  if (!team) return <Redirect href="/buscar" />;
  return <WeeklyAgenda key={`${team.id}:${team.timezone}`} {...team} />;
}
