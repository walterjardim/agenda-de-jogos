import { Temporal } from '@js-temporal/polyfill';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { CalendarIcon } from '../../../shared/components/CalendarIcon';
import { theme } from '../../../shared/theme/theme';
import { HomeMenu, HomeMenuItem } from '../../home/components/HomeMenu';
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
  gameDate,
  gamesInWeek,
  type Match,
  weekInTimezone,
} from '../model';
import { previewTeam } from '../preview';

const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function useLocalDay(timezone: string) {
  const [day, setDay] = useState(() =>
    Temporal.Now.plainDateISO(timezone).toString(),
  );
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      clearTimeout(timer);
      const now = Temporal.Now.zonedDateTimeISO(timezone);
      const date = now.toPlainDate();
      setDay(date.toString());
      const tomorrow = date.add({ days: 1 }).toZonedDateTime(timezone);
      timer = setTimeout(
        refresh,
        tomorrow.epochMilliseconds - now.epochMilliseconds,
      );
    }
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [timezone]);
  return day;
}

function WeekCalendar({
  week,
  today,
  timezone,
  matches,
}: {
  week: ReturnType<typeof weekInTimezone>;
  today: string;
  timezone: string;
  matches: Match[];
}) {
  const start = Temporal.PlainDate.from(week.from);
  const matchDays = new Set(
    matches.map(({ startsAt }) => gameDate(startsAt, timezone)),
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
          const isToday = date.toString() === today;
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

function AgendaMatchCard({
  match,
  teamName,
  timezone,
  today = false,
  onPress,
}: {
  match: Match;
  teamName: string;
  timezone: string;
  today?: boolean;
  onPress: () => void;
}) {
  const sameDayArrival =
    gameDate(match.startsAt, timezone) === gameDate(match.arrivalAt, timezone);

  return (
    <View
      style={[styles.card, agendaStyles.card, today && agendaStyles.todayCard]}
    >
      <Text style={agendaStyles.matchTime}>
        Jogo · {formatGameTime(match.startsAt, timezone, !today)}
      </Text>
      <Text accessibilityRole="header" style={styles.title}>
        {teamName} × {match.opponent}
      </Text>
      <Text style={styles.text}>
        Chegada ·{' '}
        {formatGameTime(match.arrivalAt, timezone, !today || !sameDayArrival)}
      </Text>
      {today && Boolean(match.location) && (
        <Text style={styles.text}>{match.location}</Text>
      )}
      <ActionButton label="Ver ficha" primary={today} onPress={onPress} />
    </View>
  );
}

function WeeklyAgenda({ id, timezone, token }: AgendaTeam) {
  const router = useRouter();
  const today = useLocalDay(timezone);
  const week = useMemo(
    () =>
      weekInTimezone(
        timezone,
        Temporal.PlainDate.from(today).toZonedDateTime(timezone).toInstant(),
      ),
    [timezone, today],
  );
  const { previewMatches } = usePreview();
  const loadTeam = useCallback(
    async () => (token ? fetchTeam(id, token) : previewTeam),
    [id, token],
  );
  const teamResource = useMatchResource(loadTeam);
  const selectedTeam =
    teamResource.state.status === 'ready' ? teamResource.state.data : null;
  const load = useCallback(async () => {
    const matches = token
      ? await fetchWeek(id, token, week.from, week.to)
      : previewMatches;
    return { week, matches: gamesInWeek(matches, week, timezone) };
  }, [id, previewMatches, timezone, token, week]);
  const { state, retry } = useMatchResource(load);
  const data =
    state.status === 'ready' && state.data.week.from === week.from
      ? state.data
      : null;
  const todayMatches = data?.matches.filter(
    ({ startsAt }) => gameDate(startsAt, timezone) === today,
  );
  const otherMatches = data?.matches.filter(
    ({ startsAt }) => gameDate(startsAt, timezone) !== today,
  );
  const teamName = selectedTeam?.name ?? 'Time';

  function openMatch(id: string) {
    router.push({ pathname: '/jogo/[id]', params: { id } });
  }

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
        week={week}
        today={today}
        timezone={timezone}
        matches={data?.matches ?? []}
      />
      <View style={agendaStyles.section}>
        <Text accessibilityRole="header" style={agendaStyles.sectionTitle}>
          Jogos do dia
        </Text>
        {(state.status === 'loading' ||
          (state.status === 'ready' && !data)) && <LoadingMatches />}
        {state.status === 'error' && (
          <MatchLoadError error={state.error} retry={retry} />
        )}
        {todayMatches?.length === 0 && (
          <View style={[styles.card, agendaStyles.card]}>
            <Text accessibilityLiveRegion="polite" style={styles.text}>
              Nenhum jogo hoje.
            </Text>
          </View>
        )}
        {todayMatches?.map((match) => (
          <AgendaMatchCard
            key={match.id}
            match={match}
            teamName={teamName}
            timezone={timezone}
            today
            onPress={() => openMatch(match.id)}
          />
        ))}
      </View>
      <HomeMenu>
        {(!token || selectedTeam) && (
          <HomeMenuItem
            icon="add"
            label="Novo jogo"
            primary
            onPress={() => router.push('/novo-jogo')}
          />
        )}
        <HomeMenuItem
          icon="swap"
          label="Trocar time"
          onPress={() =>
            router.navigate(token ? '/trocar-time' : '/meus-times')
          }
        />
        {selectedTeam && (
          <>
            <HomeMenuItem
              icon="teams"
              label="Elenco"
              onPress={() => router.push('/elenco')}
            />
            <HomeMenuItem
              icon="trophy"
              label="Competições"
              onPress={() => router.push('/competicoes')}
            />
          </>
        )}
      </HomeMenu>
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
      {data && (
        <View style={agendaStyles.section}>
          <Text accessibilityRole="header" style={agendaStyles.sectionTitle}>
            Demais jogos da semana
          </Text>
          {otherMatches?.length === 0 && (
            <View style={[styles.card, agendaStyles.card]}>
              <Text accessibilityLiveRegion="polite" style={styles.text}>
                {data.matches.length
                  ? 'Nenhum outro jogo nesta semana.'
                  : 'Nenhum jogo nesta semana.'}
              </Text>
            </View>
          )}
          {otherMatches?.map((match) => (
            <AgendaMatchCard
              key={match.id}
              match={match}
              teamName={teamName}
              timezone={timezone}
              onPress={() => openMatch(match.id)}
            />
          ))}
        </View>
      )}
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
    backgroundColor: theme.colors.accent,
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
  card: { borderColor: theme.colors.surfaceBorder },
  section: { gap: 8 },
  sectionTitle: { color: theme.colors.text, fontSize: 19, fontWeight: '800' },
  todayCard: {
    backgroundColor: theme.colors.accentSurface,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accent,
  },
  matchTime: { color: theme.colors.accent, fontSize: 14, fontWeight: '700' },
});
