import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { TableActions } from '../../shared/components/TableActions';
import { tableStyles as rosterStyles } from '../../shared/theme/table';
import { FormField } from '../../shared/components/FormInput';
import { ApiError } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { ActionButton } from '../../shared/components/ActionButton';
import { HomeScreen } from '../home/components/HomeScreen';
import { usePreview } from '../home/PreviewContext';
import { fetchAthletes, fetchCompetitions, fetchTeam } from '../matches/api';
import {
  LoadingMatches,
  MatchLoadError,
  SelectField,
  styles,
} from '../matches/components/MatchViews';
import {
  type AgendaTeam,
  useAgendaTeam,
  useMatchResource,
} from '../matches/hooks';
import type { Athlete, Competition, Team } from '../matches/model';
import { previewTeam } from '../matches/preview';
import {
  createTeamRecord,
  deleteTeamRecord,
  type RecordInput,
  type RecordKind,
  updateTeamRecord,
} from './api';

const statuses = {
  active: 'Ativo',
  injured: 'Lesionado',
  suspended: 'Suspenso',
} satisfies Record<Athlete['status'], string>;

const statusOptions = Object.entries(statuses).map(([id, label]) => ({
  id,
  label,
}));
const screens = {
  athletes: {
    list: '/elenco',
    editor: '/atleta',
    title: 'Elenco',
    formTitle: 'Atleta',
    create: 'Novo atleta',
    save: 'Salvar atleta',
    remove: 'Excluir atleta',
    empty: 'Nenhum atleta cadastrado.',
  },
  competitions: {
    list: '/competicoes',
    editor: '/competicao',
    title: 'Competições',
    formTitle: 'Competição',
    create: 'Nova competição',
    save: 'Salvar competição',
    remove: 'Excluir competição',
    empty: 'Nenhuma competição cadastrada.',
  },
} as const;

type TeamRecord = Athlete | Competition;
type TeamRecordsData = { team: Team; records: TeamRecord[] };

function useTeamRecords(kind: RecordKind, { id, token }: AgendaTeam) {
  const { previewAthletes, previewCompetitions } = usePreview();
  const previewRecords =
    kind === 'athletes' ? previewAthletes : previewCompetitions;
  const load = useCallback(async (): Promise<TeamRecordsData | null> => {
    const [team, records] = token
      ? await Promise.all([
          fetchTeam(id, token),
          kind === 'athletes'
            ? fetchAthletes(id, token)
            : fetchCompetitions(id, token),
        ])
      : [previewTeam, previewRecords];

    if (!team) return null;
    const sorted = [...records].sort((a: TeamRecord, b: TeamRecord) =>
      'shirtNumber' in a && 'shirtNumber' in b
        ? a.shirtNumber - b.shirtNumber
        : a.name.localeCompare(b.name, 'pt-BR'),
    );
    return { team, records: sorted };
  }, [id, kind, previewRecords, token]);

  return useMatchResource(load);
}

function RosterTable({
  athletes,
  team,
  isOwner,
  onRemoved,
}: {
  athletes: Athlete[];
  team: AgendaTeam;
  isOwner: boolean;
  onRemoved: () => void;
}) {
  const router = useRouter();
  const { deletePreviewRecord } = usePreview();
  const { invalidateSession } = useAuth();
  const [removing, setRemoving] = useState<Athlete | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  async function remove() {
    if (!removing || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (team.token)
        await deleteTeamRecord('athletes', removing.id, team.token);
      else deletePreviewRecord('athletes', removing.id);
      setRemoving(null);
      onRemoved();
    } catch (failure) {
      if (team.token && failure instanceof ApiError && failure.status === 401) {
        await invalidateSession(team.token);
      } else {
        setError(
          failure instanceof ApiError && failure.status === 403
            ? 'Somente o criador do time pode remover atletas.'
            : failure instanceof ApiError && failure.status === 404
              ? 'Atleta indisponível. Atualize a lista.'
              : 'Não foi possível confirmar a remoção. Confira a conexão e atualize a lista antes de tentar novamente.',
        );
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <View
      role="table"
      accessibilityLabel="Elenco do time"
      style={rosterStyles.table}
    >
      <View role="row" style={[rosterStyles.row, rosterStyles.header]}>
        <Text
          role="columnheader"
          style={[rosterStyles.heading, rosterStyles.number]}
        >
          Nº
        </Text>
        <Text
          role="columnheader"
          style={[rosterStyles.heading, rosterStyles.player]}
        >
          Atleta
        </Text>
        {isOwner && (
          <Text
            role="columnheader"
            style={[rosterStyles.heading, rosterStyles.actions]}
          >
            Ações
          </Text>
        )}
      </View>
      {athletes.map((athlete) => (
        <View key={athlete.id} role="rowgroup" style={rosterStyles.record}>
          <View role="row" style={rosterStyles.row}>
            <Text role="cell" style={[styles.label, rosterStyles.number]}>
              {athlete.shirtNumber}
            </Text>
            <View
              role="cell"
              style={[rosterStyles.player, rosterStyles.details]}
            >
              <Text style={styles.label}>{athlete.name}</Text>
              <Text style={rosterStyles.position}>{athlete.position}</Text>
              <Text
                style={[
                  rosterStyles.status,
                  athlete.status !== 'active' && rosterStyles.unavailable,
                ]}
              >
                {statuses[athlete.status]}
              </Text>
            </View>
            {isOwner && (
              <TableActions
                itemName={athlete.name}
                disabled={busy}
                onEdit={() =>
                  router.push({
                    pathname: '/atleta',
                    params: { id: athlete.id },
                  })
                }
                onRemove={() => {
                  setRemoving(athlete);
                  setError('');
                }}
              />
            )}
          </View>
          {removing?.id === athlete.id && (
            <View style={rosterStyles.confirmation}>
              <Text style={styles.label}>
                Remover {athlete.name} do elenco e das convocações?
              </Text>
              {!!error && (
                <View style={styles.field}>
                  <Text accessibilityLiveRegion="polite" style={styles.error}>
                    {error}
                  </Text>
                  <ActionButton
                    icon="refresh"
                    label="Atualizar lista"
                    disabled={busy}
                    onPress={onRemoved}
                  />
                </View>
              )}
              <View style={styles.row}>
                <ActionButton
                  icon="remove"
                  label={busy ? 'Removendo…' : 'Confirmar remoção'}
                  destructive
                  disabled={busy}
                  onPress={() => void remove()}
                />
                <ActionButton
                  icon="cancel"
                  label="Cancelar"
                  disabled={busy}
                  onPress={() => {
                    setRemoving(null);
                    setError('');
                  }}
                />
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function Records({ kind, team }: { kind: RecordKind; team: AgendaTeam }) {
  const router = useRouter();
  const screen = screens[kind];
  const { state, retry } = useTeamRecords(kind, team);
  const data = state.status === 'ready' ? state.data : null;

  return (
    <HomeScreen
      title={screen.title}
      description={data?.team.name}
      standalone
      onBack={() =>
        router.canGoBack() ? router.back() : router.dismissTo('/agenda')
      }
    >
      {state.status === 'loading' && <LoadingMatches />}
      {state.status === 'error' && (
        <MatchLoadError error={state.error} retry={retry} />
      )}
      {state.status === 'ready' && !data && (
        <Text style={styles.text}>Time indisponível.</Text>
      )}
      {data?.records.length === 0 && (
        <Text style={styles.text}>{screen.empty}</Text>
      )}
      {kind === 'athletes' && data && data.records.length > 0 && (
        <RosterTable
          athletes={data.records.filter(
            (record): record is Athlete => 'shirtNumber' in record,
          )}
          team={team}
          isOwner={data.team.isOwner === true}
          onRemoved={retry}
        />
      )}
      {kind === 'competitions' &&
        data?.records.map((record) => (
          <View key={record.id} style={styles.card}>
            <Text style={styles.title}>{record.name}</Text>
            {data.team.isOwner === true && (
              <ActionButton
                icon="edit"
                label={`Editar ${record.name}`}
                onPress={() =>
                  router.push({
                    pathname: screen.editor,
                    params: { id: record.id },
                  })
                }
              />
            )}
          </View>
        ))}
      <View style={styles.row}>
        {data?.team.isOwner === true && (
          <ActionButton
            icon="add"
            label={screen.create}
            primary
            onPress={() => router.push(screen.editor)}
          />
        )}
      </View>
    </HomeScreen>
  );
}

function Editor({
  kind,
  team,
  record,
  records,
}: {
  kind: RecordKind;
  team: AgendaTeam;
  record?: TeamRecord;
  records: TeamRecord[];
}) {
  const router = useRouter();
  const { savePreviewRecord, deletePreviewRecord } = usePreview();
  const { invalidateSession } = useAuth();
  const screen = screens[kind];
  const athlete = record && 'shirtNumber' in record ? record : undefined;
  const [name, setName] = useState(record?.name ?? '');
  const [position, setPosition] = useState(athlete?.position ?? '');
  const [shirt, setShirt] = useState(
    athlete ? String(athlete.shirtNumber) : '',
  );
  const [status, setStatus] = useState<Athlete['status']>(
    athlete?.status ?? 'active',
  );
  const [fieldError, setFieldError] = useState<{
    field: 'name' | 'position' | 'shirt';
    message: string;
  }>();
  const nameRef = useRef<TextInput>(null);
  const positionRef = useRef<TextInput>(null);
  const shirtRef = useRef<TextInput>(null);
  function invalid(field: 'name' | 'position' | 'shirt', message: string) {
    setError('');
    setFieldError({ field, message });
    ({ name: nameRef, position: positionRef, shirt: shirtRef })[
      field
    ].current?.focus();
  }
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  function back() {
    router.dismissTo(screen.list);
  }

  async function submit(removing: boolean) {
    if (pending.current || (removing && !record)) return;

    const cleanName = name.trim();
    const nameLimit = kind === 'athletes' ? 80 : 120;
    const cleanPosition = position.trim();
    const shirtNumber = Number(shirt.trim());
    let body: RecordInput = { name: cleanName };

    if (!removing) {
      if (!cleanName || cleanName.length > nameLimit) {
        invalid('name', `Informe um nome com 1 a ${nameLimit} caracteres.`);
        return;
      }

      if (kind === 'athletes') {
        if (!cleanPosition) {
          invalid('position', 'Informe uma posição, como Goleiro.');
          return;
        }
        if (!/^\d{1,3}$/.test(shirt.trim())) {
          invalid('shirt', 'Informe um número inteiro de 0 a 999.');
          return;
        }
        if (
          !team.token &&
          records.some(
            (item) =>
              'shirtNumber' in item &&
              item.id !== record?.id &&
              item.shirtNumber === shirtNumber,
          )
        ) {
          invalid('shirt', 'Esse número de camisa já está em uso no time.');
          return;
        }
        body = {
          name: cleanName,
          position: cleanPosition,
          shirtNumber,
          status,
        };
      }
    }

    setFieldError(undefined);
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (removing && record) {
        if (team.token) await deleteTeamRecord(kind, record.id, team.token);
        else deletePreviewRecord(kind, record.id);
      } else if (!team.token) {
        savePreviewRecord(body, record?.id);
      } else if (record) {
        const patch = Object.fromEntries(
          Object.entries(body).filter(
            ([key, value]) => record[key as keyof typeof record] !== value,
          ),
        );
        if (Object.keys(patch).length > 0)
          await updateTeamRecord(kind, record.id, team.token, patch);
      } else {
        await createTeamRecord(kind, team.id, team.token, body);
      }
      back();
    } catch (failure) {
      if (team.token && failure instanceof ApiError && failure.status === 401) {
        await invalidateSession(team.token);
      } else if (failure instanceof ApiError && failure.status === 403) {
        setError('Somente o criador do time pode alterar esse cadastro.');
      } else if (failure instanceof ApiError && failure.status === 404) {
        setError(
          record
            ? kind === 'athletes'
              ? 'Atleta indisponível neste time.'
              : 'Competição indisponível neste time.'
            : 'Time indisponível.',
        );
      } else if (
        failure instanceof ApiError &&
        failure.status === 409 &&
        kind === 'athletes'
      ) {
        invalid('shirt', 'Esse número de camisa já está em uso no time.');
      } else {
        setError(
          removing
            ? 'Não foi possível confirmar a exclusão. Confira a lista antes de tentar novamente.'
            : 'Não foi possível confirmar o salvamento. Confira os dados e a conexão.',
        );
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <View style={styles.card}>
        <FormField
          label="Nome"
          ref={nameRef}
          error={fieldError?.field === 'name' ? fieldError.message : undefined}
          value={name}
          maxLength={kind === 'athletes' ? 80 : 120}
          onChangeText={(value) => {
            if (fieldError?.field === 'name') setFieldError(undefined);
            setName(value);
          }}
          editable={!busy && !confirming}
        />
        {kind === 'athletes' && (
          <>
            <FormField
              label="Posição"
              ref={positionRef}
              error={
                fieldError?.field === 'position'
                  ? fieldError.message
                  : undefined
              }
              value={position}
              onChangeText={(value) => {
                if (fieldError?.field === 'position') setFieldError(undefined);
                setPosition(value);
              }}
              editable={!busy && !confirming}
            />
            <FormField
              label="Número da camisa"
              ref={shirtRef}
              error={
                fieldError?.field === 'shirt' ? fieldError.message : undefined
              }
              value={shirt}
              maxLength={3}
              onChangeText={(value) => {
                if (fieldError?.field === 'shirt') setFieldError(undefined);
                setShirt(value);
              }}
              keyboardType="number-pad"
              editable={!busy && !confirming}
            />
            <SelectField
              label="Status"
              value={status}
              options={statusOptions}
              onChange={(value) => setStatus(value as Athlete['status'])}
              disabled={busy || confirming}
            />
          </>
        )}
      </View>
      {Boolean(error) && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
      {confirming ? (
        <View style={[styles.card, styles.highlighted]}>
          <Text style={styles.label}>
            {kind === 'athletes'
              ? team.token
                ? 'Excluir este atleta do elenco?'
                : 'Excluir este atleta do elenco e das convocações?'
              : 'Excluir esta competição? Os jogos vinculados ficarão sem competição.'}
          </Text>
          <View style={styles.row}>
            <ActionButton
              icon="remove"
              label="Confirmar exclusão"
              primary
              disabled={busy}
              onPress={() => void submit(true)}
            />
            <ActionButton
              icon="cancel"
              label="Cancelar exclusão"
              disabled={busy}
              onPress={() => {
                setConfirming(false);
                setError('');
              }}
            />
            <ActionButton
              icon="back"
              label="Voltar à lista"
              disabled={busy}
              onPress={back}
            />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <ActionButton
            icon="save"
            label={busy ? 'Salvando…' : screen.save}
            primary
            disabled={busy}
            onPress={() => void submit(false)}
          />
          {record && (
            <ActionButton
              icon="remove"
              label={screen.remove}
              destructive
              disabled={busy}
              onPress={() => {
                setConfirming(true);
                setError('');
              }}
            />
          )}
          <ActionButton
            icon="back"
            label="Voltar à lista"
            disabled={busy}
            onPress={back}
          />
        </View>
      )}
    </>
  );
}

function RecordEditor({
  kind,
  team,
  id,
}: {
  kind: RecordKind;
  team: AgendaTeam;
  id?: string;
}) {
  const router = useRouter();
  const screen = screens[kind];
  const { state, retry } = useTeamRecords(kind, team);
  const data = state.status === 'ready' ? state.data : null;
  const record = id ? data?.records.find((item) => item.id === id) : undefined;
  const available = data?.team.isOwner === true && (!id || Boolean(record));

  return (
    <HomeScreen
      title={screen.formTitle}
      description={data?.team.name}
      standalone
      onBack={() => router.dismissTo(screen.list)}
    >
      {state.status === 'loading' && <LoadingMatches />}
      {state.status === 'error' && (
        <MatchLoadError error={state.error} retry={retry} />
      )}
      {state.status === 'ready' && !data && (
        <Text style={styles.text}>Time indisponível.</Text>
      )}
      {data && data.team.isOwner !== true && (
        <Text style={styles.text}>
          Somente o criador do time pode alterar este cadastro.
        </Text>
      )}
      {data?.team.isOwner === true && id && !record && (
        <Text style={styles.text}>Cadastro indisponível neste time.</Text>
      )}
      {available && (
        <Editor
          kind={kind}
          team={team}
          record={record}
          records={data.records}
        />
      )}
    </HomeScreen>
  );
}

function TeamRecordsRoute({
  kind,
  edit = false,
}: {
  kind: RecordKind;
  edit?: boolean;
}) {
  const team = useAgendaTeam();
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!team) return <Redirect href="/buscar" />;
  return edit ? (
    <RecordEditor
      key={`${team.id}:${id ?? 'new'}`}
      kind={kind}
      team={team}
      id={id}
    />
  ) : (
    <Records key={team.id} kind={kind} team={team} />
  );
}

export function RosterScreen() {
  return <TeamRecordsRoute kind="athletes" />;
}
export function CompetitionsScreen() {
  return <TeamRecordsRoute kind="competitions" />;
}
export function AthleteScreen() {
  return <TeamRecordsRoute kind="athletes" edit />;
}
export function CompetitionScreen() {
  return <TeamRecordsRoute kind="competitions" edit />;
}
