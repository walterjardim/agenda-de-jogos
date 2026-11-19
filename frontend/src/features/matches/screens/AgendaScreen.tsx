import { Temporal } from '@js-temporal/polyfill';
import { Redirect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CalendarIcon } from '../../../shared/components/CalendarIcon';
import { theme } from '../../../shared/theme/theme';
import { ActionButton, HomeScreen } from '../../home/components/HomeScreen';
import { usePreview } from '../../home/PreviewContext';
import { fetchTeam, fetchWeek } from '../api';
import {
  LoadingMatches,
  MatchLoadError,
  styles,
} from '../components/MatchViews';
import { type AgendaTeam, useAgendaTeam, useMatchResource } from '../hooks';
import {
  formatGameTime,
  gamesInWeek,
  type Match,
  weekInTimezone,
} from '../model';
import { previewTeam } from '../preview';

const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function WeekCalendar({
  week,
  timezone,
  matches,
}: {
  week: ReturnType<typeof weekInTimezone>;
  timezone: string;
  matches: Match[];
}) {
  const start = Temporal.PlainDate.from(week.from);
  const today = Temporal.Now.plainDateISO(timezone);
  const matchDays = new Set(
    matches.map(({ startsAt }) =>
      Temporal.Instant.from(startsAt)
        .toZonedDateTimeISO(timezone)
        .toPlainDate()
        .toString(),
    ),
  );

  return (
    <View style={agendaStyles.calendar}>
      <View style={agendaStyles.calendarHeading}>
        <CalendarIcon size={22} color={theme.colors.white} />
        <Text style={agendaStyles.period}>{week.label}</Text>
      </View>
      <View style={agendaStyles.days}>
        {weekdays.map((weekday, index) => {
          const date = start.add({ days: index });
          const hasMatch = matchDays.has(date.toString());
          const isToday = date.equals(today);
          return (
            <View
              key={weekday}
              accessible
              accessibilityLabel={`${weekday} ${date.day}${isToday ? ', hoje' : ''}${hasMatch ? ', dia de jogo' : ''}`}
              style={[agendaStyles.day, isToday && agendaStyles.today]}
            >
              <Text style={agendaStyles.weekday}>{weekday}</Text>
              <Text style={agendaStyles.dayNumber}>{date.day}</Text>
              <View
                style={[agendaStyles.dot, hasMatch && agendaStyles.matchDot]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

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
      <WeekCalendar
        week={data?.week ?? weekInTimezone(timezone)}
        timezone={timezone}
        matches={data?.matches ?? []}
      />
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
      {selectedTeam && (
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
        <View style={[styles.card, agendaStyles.card]}>
          <Text accessibilityLiveRegion="polite" style={styles.text}>
            Nenhum jogo nesta semana.
          </Text>
        </View>
      )}
      {data?.matches.map((match) => (
        <View key={match.id} style={[styles.card, agendaStyles.card]}>
          <Text style={agendaStyles.matchTime}>
            Jogo · {formatGameTime(match.startsAt, timezone)}
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            {selectedTeam?.name ?? 'Time'} × {match.opponent}
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

const agendaStyles = StyleSheet.create({
  calendar: {
    padding: 12,
    gap: 12,
    borderRadius: 20,
    backgroundColor: '#9F1820',
  },
  calendarHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  period: {
    flex: 1,
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  days: { flexDirection: 'row', gap: 2 },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
    borderRadius: 10,
  },
  today: { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  weekday: { color: theme.colors.white, fontSize: 11 },
  dayNumber: { color: theme.colors.white, fontSize: 16, fontWeight: '800' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  matchDot: { backgroundColor: theme.colors.white },
  card: { borderColor: '#E5DEE0' },
  matchTime: { color: '#9F1820', fontSize: 14, fontWeight: '700' },
});
