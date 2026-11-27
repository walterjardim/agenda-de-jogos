import { Temporal } from '@js-temporal/polyfill';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { BottomTabNavigationProp } from 'expo-router/js-tabs';
import {
  type ComponentRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { theme } from '../../../shared/theme/theme';
import { useAuth } from '../../auth/AuthContext';
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
  moveWeek,
  showToday,
}: {
  week: ReturnType<typeof weekInTimezone>;
  today: string;
  timezone: string;
  matches: Match[];
  selectedDay: string | null;
  selectDay: (day: string) => void;
  moveWeek: (offset: number) => void;
  showToday: () => void;
}) {
  const start = Temporal.PlainDate.from(week.from);
  const end = start.add({ days: 6 });
  const monthLabel = end.toLocaleString('pt-BR', { month: 'short' });
  const period =
    start.month === end.month && start.year === end.year
      ? `${start.day}–${end.day} ${monthLabel} ${end.year}`
      : week.label;
  const { fontScale } = useWindowDimensions();
  const [daysWidth, setDaysWidth] = useState(0);
  const dayMinWidth = Math.max(48, Math.ceil(36 * fontScale));
  const availableColumns = Math.floor((daysWidth + 2) / (dayMinWidth + 2));
  const columns =
    availableColumns >= 7 ? 7 : Math.max(1, Math.min(4, availableColumns));
  const dayWidth =
    daysWidth > 0
      ? Math.floor((daysWidth - (columns - 1) * 2) / columns)
      : dayMinWidth;

  const dayButtons = useRef<(ComponentRef<typeof Pressable> | null)[]>([]);
  const tabStop = selectedDay ?? week.from;

  function moveDay(
    event: { nativeEvent: { key: string }; preventDefault: () => void },
    index: number,
  ) {
    const key = event.nativeEvent.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key))
      return;
    event.preventDefault();
    const step = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
    const next = (index + step + weekdays.length) % weekdays.length;
    selectDay(start.add({ days: next }).toString());
    dayButtons.current[next]?.focus();
  }
  const matchDays = new Set(
    matches.map(({ startsAt }) => gameDate(startsAt, timezone)),
  );

  return (
    <View style={agendaStyles.calendar}>
      <View style={agendaStyles.calendarHeading}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Semana anterior"
          onPress={() => moveWeek(-1)}
          style={agendaStyles.calendarButton}
        >
          <Text style={agendaStyles.arrow}>‹</Text>
        </Pressable>
        <Text
          accessibilityLiveRegion="polite"
          aria-live="polite"
          style={agendaStyles.period}
        >
          {period}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Próxima semana"
          onPress={() => moveWeek(1)}
          style={agendaStyles.calendarButton}
        >
          <Text style={agendaStyles.arrow}>›</Text>
        </Pressable>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Dia da agenda"
        onLayout={({ nativeEvent }) => setDaysWidth(nativeEvent.layout.width)}
        style={agendaStyles.days}
      >
        {weekdays.map((weekday, index) => {
          const date = start.add({ days: index });
          const hasMatch = matchDays.has(date.toString());
          const isToday = date.toString() === today;
          const selected = date.toString() === selectedDay;
          return (
            <Pressable
              key={weekday}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              ref={(button) => {
                dayButtons.current[index] = button;
              }}
              {...(Platform.OS === 'web' && {
                tabIndex: date.toString() === tabStop ? 0 : -1,
                onKeyDown: (event: Parameters<typeof moveDay>[0]) =>
                  moveDay(event, index),
              })}
              onPress={() => selectDay(date.toString())}
              accessibilityLabel={`${date.toLocaleString('pt-BR', { dateStyle: 'full' })}${isToday ? ', hoje' : ''}${hasMatch ? ', dia de jogo' : ''}`}
              style={({ pressed }) => [
                agendaStyles.day,
                { width: dayWidth },
                pressed && agendaStyles.pressed,
                selected && agendaStyles.selected,
              ]}
            >
              <Text style={agendaStyles.weekday}>{weekday}</Text>
              <Text style={agendaStyles.dayNumber}>{date.day}</Text>
              <View style={agendaStyles.dayStatus}>
                {isToday && <Text style={agendaStyles.weekday}>Hoje</Text>}
                {hasMatch && <View style={agendaStyles.matchDot} />}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={agendaStyles.calendarFooter}>
        {matchDays.size > 0 && (
          <View style={agendaStyles.legend}>
            <View style={agendaStyles.matchDot} />
            <Text style={agendaStyles.weekday}>Dia de jogo</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={showToday}
          style={agendaStyles.calendarButton}
        >
          <Text style={agendaStyles.todayAction}>Hoje</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AgendaMatchCard({
  match,
  teamName,
  timezone,
  today,
  showDate,
  onPress,
}: {
  match: Match;
  teamName: string;
  timezone: string;
  today: boolean;
  showDate: boolean;
  onPress: () => void;
}) {
  const sameDayArrival =
    gameDate(match.startsAt, timezone) === gameDate(match.arrivalAt, timezone);

  return (
    <View
      style={[styles.card, agendaStyles.card, today && agendaStyles.todayCard]}
    >
      <Text accessibilityRole="header" style={styles.title}>
        {teamName} × {match.opponent}
      </Text>
      <Text style={agendaStyles.matchTime}>
        Jogo · {formatGameTime(match.startsAt, timezone, showDate)}
      </Text>
      <Text style={styles.text}>
        Chegada · {formatGameTime(match.arrivalAt, timezone, !sameDayArrival)}
      </Text>
      {Boolean(match.location) && (
        <Text style={styles.text}>{match.location}</Text>
      )}
      <ActionButton label="Ver ficha" onPress={onPress} />
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
  const navigation =
    useNavigation<BottomTabNavigationProp<{ agenda: undefined }>>();

  const today = useLocalDay(timezone);
  const { dia, jogo } = useLocalSearchParams<{ dia?: string; jogo?: string }>();
  const routeKey = `${dia ?? ''}:${jogo ?? ''}`;
  const [selection, setSelection] = useState<
    | { routeKey: string; mode: 'today' }
    | { routeKey: string; mode: 'calendar'; anchor: string; day: string | null }
  >();
  const routeDay = parseAgendaDay(dia) ?? today;
  const current = selection?.routeKey === routeKey ? selection : undefined;
  const anchor =
    current?.mode === 'calendar' ? current.anchor : current ? today : routeDay;
  const selectedDay = current?.mode === 'calendar' ? current.day : anchor;

  const showToday = useCallback(() => {
    setSelection({ routeKey, mode: 'today' });
  }, [routeKey]);

  useEffect(
    () => navigation.addListener('tabPress', showToday),
    [navigation, showToday],
  );

  function show(anchor: string, day: string | null) {
    setSelection({ anchor, day, routeKey, mode: 'calendar' });
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
      compactHeader
      description={
        selectedTeam
          ? `${selectedTeam.name} · ${selectedTeam.category}`
          : undefined
      }
    >
      <WeekCalendar
        week={week}
        moveWeek={moveWeek}
        showToday={showToday}
        today={today}
        timezone={timezone}
        matches={data?.matches ?? []}
        selectedDay={selectedDay}
        selectDay={(day) => show(day, day)}
      />
      <View style={agendaStyles.section}>
        <View style={agendaStyles.sectionHeading}>
          <Text
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            aria-live="polite"
            style={agendaStyles.sectionTitle}
          >
            {selectedDay === today
              ? 'Jogos de hoje'
              : selectedDay
                ? `Jogos de ${formatDate(Temporal.PlainDate.from(selectedDay))}`
                : 'Jogos da semana'}
          </Text>
          {selectedDay && (
            <Pressable
              accessibilityRole="button"
              onPress={() => show(anchor, null)}
              style={agendaStyles.calendarButton}
            >
              <Text style={agendaStyles.weekAction}>Ver semana</Text>
            </Pressable>
          )}
        </View>
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
            showDate={!selectedDay}
            today={gameDate(match.startsAt, timezone) === today}
            onPress={() => openMatch(match.id)}
          />
        ))}
      </View>
      <HomeMenu>
        {selectedTeam?.isOwner && (
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
            {selectedTeam.isOwner && (
              <HomeMenuItem
                icon="teams"
                label="Elenco"
                onPress={() => router.push('/elenco')}
              />
            )}
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
  const router = useRouter();
  const { session } = useAuth();
  if (!team) {
    return (
      <HomeScreen title="Agenda">
        <View style={styles.card}>
          <Text style={styles.text}>
            Escolha um time para ver os jogos na agenda.
          </Text>
          <ActionButton
            label="Escolher um time"
            primary
            onPress={() => router.navigate('/buscar')}
          />
          {session && (
            <ActionButton
              label="Cadastrar meu time"
              onPress={() =>
                router.navigate({
                  pathname: '/meus-times',
                  params: { cadastrar: 'sim' },
                })
              }
            />
          )}
        </View>
      </HomeScreen>
    );
  }
  return <WeeklyAgenda key={`${team.id}:${team.timezone}`} {...team} />;
}

const agendaStyles = StyleSheet.create({
  calendar: {
    padding: 12,
    gap: 4,
    borderRadius: 20,
    backgroundColor: theme.colors.accent,
  },
  calendarHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  period: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  day: {
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 4,
    gap: 2,
    borderRadius: 10,
  },
  pressed: { opacity: 0.8 },
  selected: {
    borderColor: theme.colors.white,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  weekday: { color: theme.colors.white, fontSize: 11 },
  dayNumber: { color: theme.colors.white, fontSize: 16, fontWeight: '800' },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  calendarButton: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { color: theme.colors.white, fontSize: 26, fontWeight: '700' },
  todayAction: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  legend: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayStatus: {
    minHeight: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  matchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.white,
  },
  card: { borderColor: theme.colors.surfaceBorder },
  section: { gap: 8 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: 8,
  },
  weekAction: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  sectionTitle: { color: theme.colors.text, fontSize: 19, fontWeight: '800' },
  todayCard: {
    backgroundColor: theme.colors.accentSurface,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accent,
  },
  matchTime: { color: theme.colors.accent, fontSize: 14, fontWeight: '700' },
});
