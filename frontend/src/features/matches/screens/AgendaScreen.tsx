import { Temporal } from '@js-temporal/polyfill';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarIcon } from '../../../shared/components/CalendarIcon';
import { theme } from '../../../shared/theme/theme';
import { HomeMenu, HomeMenuItem } from '../../home/components/HomeMenu';
import { ActionButton } from '../../../shared/components/ActionButton';
import { HomeScreen } from '../../home/components/HomeScreen';
import { usePreview } from '../../home/PreviewContext';
import { fetchTeam, fetchWeek } from '../api';
import {
  LoadingMatches,
  MatchLoadError,
  styles,
} from '../components/MatchViews';
import { type AgendaTeam, useAgendaTeam, useMatchResource } from '../hooks';
import {
  formatDate,
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
  selectedDay,
  selectDay,
}: {
  week: ReturnType<typeof weekInTimezone>;
  today: string;
  timezone: string;
  matches: Match[];
  selectedDay: string | null;
  selectDay: (day: string) => void;
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
          const selected = date.toString() === selectedDay;
          return (
            <Pressable
              key={weekday}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => selectDay(date.toString())}
              accessibilityLabel={`${weekday} ${date.day}${isToday ? ', hoje' : ''}${hasMatch ? ', dia de jogo' : ''}`}
              style={[
                agendaStyles.day,
                isToday && agendaStyles.today,
                selected && agendaStyles.selected,
              ]}
            >
              <Text style={agendaStyles.weekday}>{weekday}</Text>
              <Text style={agendaStyles.dayNumber}>{date.day}</Text>
              <View
                style={[agendaStyles.dot, hasMatch && agendaStyles.matchDot]}
              />
            </Pressable>
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

function parseAgendaDay(day?: string) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  try {
    return Temporal.PlainDate.from(day).toString();
  } catch {
    return undefined;
  }
}

function WeeklyAgenda({ id, timezone, token }: AgendaTeam) {
  const router = useRouter();
  const today = useLocalDay(timezone);
  const { dia, jogo } = useLocalSearchParams<{ dia?: string; jogo?: string }>();
  const routeKey = `${dia ?? ''}:${jogo ?? ''}`;
  const [selection, setSelection] = useState<{
    anchor: string;
    day: string | null;
    routeKey: string;
  }>();
  const routeDay = parseAgendaDay(dia) ?? today;
  const current = selection?.routeKey === routeKey ? selection : undefined;
  const anchor = current?.anchor ?? routeDay;
  const selectedDay = current ? current.day : routeDay;

  function show(anchor: string, day: string | null) {
    setSelection({ anchor, day, routeKey });
  }

  function moveWeek(weeks: number) {
    const next = Temporal.PlainDate.from(week.from).add({ weeks }).toString();
    show(next, null);
  }
  const week = weekInTimezone(
    timezone,
    Temporal.PlainDate.from(anchor).toZonedDateTime(timezone).toInstant(),
  );
  const { from, to, label } = week;
  const { previewMatches } = usePreview();
  const loadTeam = useCallback(
    async () => (token ? fetchTeam(id, token) : previewTeam),
    [id, token],
  );
  const teamResource = useMatchResource(loadTeam);
  const selectedTeam =
    teamResource.state.status === 'ready' ? teamResource.state.data : null;
  const load = useCallback(async () => {
    const requestedWeek = { from, to, label };
    const matches = token
      ? await fetchWeek(id, token, from, to)
      : previewMatches;
    return {
      week: requestedWeek,
      matches: gamesInWeek(matches, requestedWeek, timezone),
    };
  }, [id, previewMatches, timezone, token, from, to, label]);
  const { state, retry } = useMatchResource(load);
  const data =
    state.status === 'ready' && state.data.week.from === week.from
      ? state.data
      : null;
  const visibleMatches = data?.matches.filter(
    ({ startsAt }) =>
      !selectedDay || gameDate(startsAt, timezone) === selectedDay,
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
      <View style={styles.row}>
        <ActionButton label="Semana anterior" onPress={() => moveWeek(-1)} />
        <ActionButton label="Hoje" onPress={() => show(today, today)} />
        <ActionButton label="Próxima semana" onPress={() => moveWeek(1)} />
      </View>
      <WeekCalendar
        week={week}
        today={today}
        timezone={timezone}
        matches={data?.matches ?? []}
        selectedDay={selectedDay}
        selectDay={(day) => show(day, day)}
      />
      <View style={agendaStyles.section}>
        <Text accessibilityRole="header" style={agendaStyles.sectionTitle}>
          {selectedDay === today
            ? 'Jogos de hoje'
            : selectedDay
              ? `Jogos de ${formatDate(Temporal.PlainDate.from(selectedDay))}`
              : 'Jogos da semana'}
        </Text>
        {selectedDay && (
          <ActionButton
            label="Ver todos da semana"
            onPress={() => show(anchor, null)}
          />
        )}
        {(state.status === 'loading' ||
          (state.status === 'ready' && !data)) && <LoadingMatches />}
        {state.status === 'error' && (
          <MatchLoadError error={state.error} retry={retry} />
        )}
        {visibleMatches?.length === 0 && (
          <View style={[styles.card, agendaStyles.card]}>
            <Text accessibilityLiveRegion="polite" style={styles.text}>
              {selectedDay
                ? 'Nenhum jogo nesta data.'
                : 'Nenhum jogo nesta semana.'}
            </Text>
          </View>
        )}
        {visibleMatches?.map((match) => (
          <AgendaMatchCard
            key={match.id}
            match={match}
            teamName={teamName}
            timezone={timezone}
            today={gameDate(match.startsAt, timezone) === today}
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
              icon="uniform"
              label="Uniformes"
              onPress={() => router.push('/uniformes')}
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
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 8,
    gap: 4,
    borderRadius: 10,
  },
  today: { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  selected: {
    borderColor: theme.colors.white,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
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
