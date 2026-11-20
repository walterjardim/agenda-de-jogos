import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { FormField } from '../../../shared/components/FormInput';
import { ApiError } from '../../auth/api';
import { useAuth } from '../../auth/AuthContext';
import { ActionButton } from '../../../shared/components/ActionButton';
import { HomeScreen } from '../../home/components/HomeScreen';
import { usePreview } from '../../home/PreviewContext';
import { createMatch, fetchCatalog, updateMatch } from '../api';
import {
  LoadingMatches,
  MatchLoadError,
  SelectField,
  styles,
} from '../components/MatchViews';
import {
  type AgendaTeam,
  useAgendaTeam,
  useMatchLoader,
  useMatchResource,
} from '../hooks';
import {
  arrivalFor,
  type Catalog,
  defaultPiece,
  formatGameTime,
  localDate,
  type MatchDetail,
  type MatchInput,
  parseFee,
  parseStart,
  pieceLabel,
  weekInTimezone,
} from '../model';
import { previewCatalog, previewMatch } from '../preview';

const pieces = [
  { key: 'shirtPieceId', type: 'shirt', label: 'Camisa' },
  { key: 'shortsPieceId', type: 'shorts', label: 'Calção' },
  { key: 'socksPieceId', type: 'socks', label: 'Meião' },
] as const;

type Draft = Pick<
  MatchInput,
  'opponent' | 'isHome' | 'competitionId' | (typeof pieces)[number]['key']
> & {
  date: string;
  time: string;
  location: string;
  fee: string;
  notes: string;
};

function initialDraft(timezone: string, match?: MatchDetail): Draft {
  const [date, time] = match
    ? formatGameTime(match.startsAt, timezone).split(' · ')
    : [localDate(timezone), ''];
  return {
    date,
    time,
    opponent: match?.opponent ?? '',
    location: match?.location ?? '',
    isHome: match?.isHome ?? true,
    competitionId: match?.competitionId ?? null,
    shirtPieceId: match ? (match.shirtPiece?.id ?? null) : undefined,
    shortsPieceId: match ? (match.shortsPiece?.id ?? null) : undefined,
    socksPieceId: match ? (match.socksPiece?.id ?? null) : undefined,
    fee:
      match?.refereeFeeCents == null
        ? ''
        : (match.refereeFeeCents / 100).toFixed(2).replace('.', ','),
    notes: match?.notes ?? '',
  };
}

function MatchForm({
  team,
  catalog,
  match,
}: {
  team: AgendaTeam;
  catalog: Catalog;
  match?: MatchDetail;
}) {
  const router = useRouter();
  const { addPreviewMatch, changePreviewMatch } = usePreview();
  const { invalidateSession } = useAuth();
  const [original] = useState(() => initialDraft(team.timezone, match));
  const [draft, setDraft] = useState(original);
  const [error, setError] = useState('');
  const [savedOutsideWeek, setSavedOutsideWeek] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const startsAt =
    match && draft.date === original.date && draft.time === original.time
      ? match.startsAt
      : parseStart(draft.date, draft.time, team.timezone);

  function back() {
    if (match)
      router.dismissTo({ pathname: '/jogo/[id]', params: { id: match.id } });
    else router.dismissTo('/agenda');
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (pending.current) return;
    const opponent = draft.opponent.trim();
    const fee = parseFee(draft.fee);

    if (!opponent || !startsAt || fee === undefined) {
      setError(
        !opponent
          ? 'Informe o adversário.'
          : !startsAt
            ? 'Informe uma data e hora válidas no fuso do perfil.'
            : 'Informe uma taxa válida com até duas casas decimais.',
      );
      return;
    }

    const body: MatchInput = {
      opponent,
      startsAt,
      location: draft.location.trim() || null,
      isHome: draft.isHome,
      competitionId: draft.competitionId,
      shirtPieceId: draft.shirtPieceId,
      shortsPieceId: draft.shortsPieceId,
      socksPieceId: draft.socksPieceId,
      refereeFeeCents: fee,
      notes: draft.notes.trim() ? draft.notes : null,
    };

    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (match) {
        const baseline = {
          ...match,
          shirtPieceId: original.shirtPieceId,
          shortsPieceId: original.shortsPieceId,
          socksPieceId: original.socksPieceId,
        };
        const patch = Object.fromEntries(
          (Object.keys(body) as (keyof MatchInput)[])
            .filter((key) => body[key] !== baseline[key])
            .map((key) => [key, body[key]]),
        );
        if (Object.keys(patch).length) {
          if (team.token) await updateMatch(match.id, team.token, patch);
          else
            changePreviewMatch(match.id, (current) =>
              previewMatch(
                {
                  ...current,
                  shirtPieceId: current.shirtPiece?.id ?? null,
                  shortsPieceId: current.shortsPiece?.id ?? null,
                  socksPieceId: current.socksPiece?.id ?? null,
                  ...patch,
                },
                current.id,
                current.hasSavedCallup ? current.callups : undefined,
                catalog.competitions,
                catalog.uniforms,
              ),
            );
        }
        back();
        return;
      }

      if (team.token) await createMatch(team.id, team.token, body);
      else addPreviewMatch(body);

      const week = weekInTimezone(team.timezone);
      const date = draft.date.split('/').reverse().join('-');
      if (date < week.from || date > week.to) {
        setSavedOutsideWeek(true);
      } else {
        router.dismissTo('/agenda');
      }
    } catch (failure) {
      if (team.token && failure instanceof ApiError && failure.status === 401) {
        await invalidateSession(team.token);
        return;
      }
      setError(
        failure instanceof ApiError && [400, 422].includes(failure.status)
          ? 'Confira os campos e as opções selecionadas.'
          : match
            ? 'Não foi possível confirmar a edição. Confira a ficha antes de tentar novamente.'
            : 'Não foi possível confirmar o cadastro. Confira a agenda antes de tentar novamente.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if (savedOutsideWeek) {
    return (
      <>
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          Jogo salvo para {draft.date}, fora da semana exibida na agenda.
        </Text>
        <ActionButton
          icon="back"
          label="Voltar à agenda"
          onPress={() => router.dismissTo('/agenda')}
        />
      </>
    );
  }

  return (
    <>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          Dados da partida
        </Text>
        <FormField
          label="Adversário"
          value={draft.opponent}
          onChangeText={(v) => update('opponent', v)}
          maxLength={120}
          editable={!busy}
        />
        <FormField
          label="Data do jogo"
          placeholder="DD/MM/AAAA"
          value={draft.date}
          maxLength={10}
          editable={!busy}
          onChangeText={(v) => update('date', v)}
        />
        <FormField
          label="Hora do jogo"
          placeholder="HH:MM"
          value={draft.time}
          maxLength={5}
          editable={!busy}
          onChangeText={(v) => update('time', v)}
        />
        <View style={[styles.card, styles.highlighted]}>
          <Text style={styles.label}>
            {startsAt
              ? `Chegada automática · ${formatGameTime(arrivalFor(startsAt), team.timezone)}`
              : 'Chegada automática · 1 hora antes do jogo'}
          </Text>
        </View>
        <FormField
          label="Local"
          value={draft.location}
          onChangeText={(v) => update('location', v)}
          maxLength={200}
          editable={!busy}
        />
        <SelectField
          label="Competição"
          value={draft.competitionId}
          disabled={busy}
          options={[
            { id: null, label: 'Sem competição' },
            ...catalog.competitions.map(({ id, name }) => ({
              id,
              label: name,
            })),
          ]}
          onChange={(v) => update('competitionId', v)}
        />
        <SelectField
          label="Mando de jogo"
          value={draft.isHome ? 'home' : 'away'}
          disabled={busy}
          options={[
            { id: 'home', label: 'Casa' },
            { id: 'away', label: 'Fora' },
          ]}
          onChange={(v) => update('isHome', v === 'home')}
        />
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          Uniforme
        </Text>
        {match && (
          <ActionButton
            icon="uniform"
            label="Aplicar padrões de uniforme"
            disabled={busy}
            onPress={() =>
              setDraft((current) => ({
                ...current,
                shirtPieceId:
                  defaultPiece(catalog.uniforms, 'shirt', current.isHome)?.id ??
                  null,
                shortsPieceId:
                  defaultPiece(catalog.uniforms, 'shorts', current.isHome)
                    ?.id ?? null,
                socksPieceId:
                  defaultPiece(catalog.uniforms, 'socks', current.isHome)?.id ??
                  null,
              }))
            }
          />
        )}
        {pieces.map(({ key, type, label }) => {
          const chosen = draft[key];
          const value =
            chosen === undefined
              ? (defaultPiece(catalog.uniforms, type, draft.isHome)?.id ?? null)
              : chosen;
          return (
            <SelectField
              key={key}
              label={label}
              value={value}
              disabled={busy}
              options={[
                { id: null, label: 'Sem seleção' },
                ...catalog.uniforms
                  .filter((piece) => piece.pieceType === type)
                  .map((piece) => ({ id: piece.id, label: pieceLabel(piece) })),
              ]}
              onChange={(v) => update(key, v)}
            />
          );
        })}
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          Taxa e observações
        </Text>
        <FormField
          label="Taxa por atleta (R$)"
          placeholder="Ex.: 15,00"
          keyboardType="decimal-pad"
          value={draft.fee}
          maxLength={15}
          editable={!busy}
          onChangeText={(v) => update('fee', v)}
        />
        <FormField
          label="Observações"
          value={draft.notes}
          maxLength={2000}
          multiline
          editable={!busy}
          onChangeText={(v) => update('notes', v)}
        />
      </View>
      {Boolean(error) && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={styles.row}>
        <ActionButton
          icon="save"
          label={busy ? 'Salvando…' : 'Salvar jogo'}
          primary
          disabled={busy}
          onPress={() => void save()}
        />
        <ActionButton
          icon="cancel"
          label="Cancelar"
          disabled={busy}
          onPress={back}
        />
      </View>
    </>
  );
}

function MatchEditor({
  team,
  matchId,
}: {
  team: AgendaTeam;
  matchId?: string;
}) {
  const router = useRouter();
  const { id, token } = team;
  const loadMatch = useMatchLoader(matchId, team);
  const { previewCompetitions, previewUniforms } = usePreview();
  const load = useCallback(async () => {
    const [catalog, match] = await Promise.all([
      token
        ? fetchCatalog(id, token)
        : {
            ...previewCatalog,
            competitions: previewCompetitions,
            uniforms: previewUniforms,
          },
      loadMatch(),
    ]);
    return { catalog, match };
  }, [id, loadMatch, token, previewCompetitions, previewUniforms]);
  const { state, retry } = useMatchResource(load);
  const data = state.status === 'ready' ? state.data : null;
  const unavailable = Boolean(matchId && data && !data.match);

  function back() {
    if (matchId)
      router.dismissTo({ pathname: '/jogo/[id]', params: { id: matchId } });
    else router.dismissTo('/agenda');
  }

  return (
    <HomeScreen
      title={matchId ? 'Editar jogo' : 'Novo jogo'}
      description={`Data e hora no fuso ${team.timezone}.`}
      standalone
    >
      {state.status === 'loading' && <LoadingMatches />}
      {state.status === 'error' && (
        <MatchLoadError error={state.error} retry={retry} />
      )}
      {unavailable && <Text style={styles.text}>Jogo indisponível.</Text>}
      {data && !unavailable ? (
        <MatchForm
          team={team}
          catalog={data.catalog}
          match={data.match ?? undefined}
        />
      ) : (
        <ActionButton
          icon="back"
          label={matchId ? 'Voltar à ficha' : 'Voltar à agenda'}
          onPress={back}
        />
      )}
    </HomeScreen>
  );
}

export function NewMatchScreen() {
  const team = useAgendaTeam();
  if (!team) return <Redirect href="/buscar" />;
  return <MatchEditor key={`${team.id}:${team.timezone}`} team={team} />;
}

export function EditMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const team = useAgendaTeam();
  if (!team || !id) return <Redirect href="/buscar" />;
  return <MatchEditor key={`${id}:${team.id}`} team={team} matchId={id} />;
}
