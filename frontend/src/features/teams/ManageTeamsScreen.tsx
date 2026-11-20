import { useEffect, useRef, useState } from 'react';
import { useIsFocused, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { FormField } from '../../shared/components/FormInput';
import { surfaces as styles } from '../../shared/theme/surfaces';
import { TeamIdentity } from './TeamIdentity';
import { ApiError } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { ActionButton } from '../../shared/components/ActionButton';
import { HomeScreen } from '../home/components/HomeScreen';
import {
  deleteTeam,
  listMyTeams,
  unfollowTeam,
  saveTeam,
  type TeamSummary,
  type TeamInput,
} from './api';

const empty: TeamInput = { name: '', sport: '', category: '' };
const fields = [
  { key: 'name', label: 'Nome do time', limit: 100 },
  { key: 'sport', label: 'Modalidade', limit: 60 },
  { key: 'category', label: 'Categoria', limit: 60 },
] as const;

export function ManageTeamsScreen({ token }: { token: string }) {
  const router = useRouter();
  const focused = useIsFocused();
  const { session, chooseTeam, invalidateSession, clearDeletedTeam } =
    useAuth();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<TeamInput | null>(null);
  const [editingId, setEditingId] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<string>();
  const [confirmUnfollow, setConfirmUnfollow] = useState<string>();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    if (!focused) return;
    let active = true;
    listMyTeams(token)
      .then((items) => {
        if (active) {
          setTeams(items);
          setLoadFailed(false);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoading(false);
        setLoadFailed(true);
        if (error instanceof ApiError && error.status === 401)
          void invalidateSession(token);
      });
    return () => {
      active = false;
    };
  }, [token, attempt, invalidateSession, focused]);

  function edit(team?: TeamSummary) {
    setEditingId(team?.id);
    setForm(
      team
        ? { name: team.name, sport: team.sport, category: team.category }
        : empty,
    );
    setConfirmDelete(undefined);
    setConfirmUnfollow(undefined);
    setNotice('');
  }

  async function submit(removeId?: string) {
    if (pending.current) return;
    if (!removeId && (!form || fields.some(({ key }) => !form[key].trim())))
      return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      if (removeId) {
        await deleteTeam(token, removeId);
        clearDeletedTeam(token, removeId);
        setTeams((items) => items.filter((item) => item.id !== removeId));
        setConfirmDelete(undefined);
        setNotice('Time excluído.');
      } else if (form) {
        const saved = await saveTeam(
          token,
          {
            name: form.name.trim(),
            sport: form.sport.trim(),
            category: form.category.trim(),
          },
          editingId,
        );
        setTeams((items) =>
          [
            ...items.filter((item) => item.id !== saved.id),
            {
              ...saved,
              isOwner: true,
              isFollowing:
                items.find((item) => item.id === saved.id)?.isFollowing ??
                false,
              athletesCount:
                items.find((item) => item.id === saved.id)?.athletesCount ?? 0,
              nextMatchAt:
                items.find((item) => item.id === saved.id)?.nextMatchAt ?? null,
            },
          ].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setForm(null);
        setEditingId(undefined);
        setNotice('Time salvo.');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await invalidateSession(token);
      } else {
        setNotice(
          error instanceof ApiError && error.status === 404
            ? 'Este time não está mais disponível. Atualize a lista.'
            : 'Não foi possível concluir. Confira os dados e a conexão e tente novamente.',
        );
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function leave(team: TeamSummary) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      await unfollowTeam(token, team.id);
      if (!team.isOwner) clearDeletedTeam(token, team.id);
      setTeams((items) =>
        team.isOwner
          ? items.map((item) =>
              item.id === team.id ? { ...item, isFollowing: false } : item,
            )
          : items.filter((item) => item.id !== team.id),
      );
      setConfirmUnfollow(undefined);
      setNotice('Você deixou de seguir o time.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        await invalidateSession(token);
      else
        setNotice(
          'Não foi possível confirmar a alteração. Atualize a lista e tente novamente.',
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function choose(id: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      await chooseTeam(id);
      router.navigate('/agenda');
    } catch {
      setNotice(
        'Não foi possível escolher este time. Atualize a lista e tente novamente.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <HomeScreen
      title="Meus times"
      description="Acesse seus times próprios e seguidos."
    >
      <ActionButton
        label="Escolher ou trocar time"
        disabled={busy}
        onPress={() => router.push('/trocar-time')}
      />
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {notice}
        </Text>
      )}
      {form ? (
        <View style={styles.card}>
          <Text style={styles.title}>
            {editingId ? 'Editar time' : 'Novo time'}
          </Text>
          {fields.map(({ key, label, limit }) => (
            <FormField
              key={key}
              label={label}
              value={form[key]}
              maxLength={limit}
              editable={!busy}
              onChangeText={(value) =>
                setForm((current) => current && { ...current, [key]: value })
              }
            />
          ))}
          <ActionButton
            label={busy ? 'Salvando…' : 'Salvar time'}
            primary
            disabled={busy || fields.some(({ key }) => !form[key].trim())}
            onPress={() => void submit()}
          />
          <ActionButton
            label="Cancelar"
            disabled={busy}
            onPress={() => setForm(null)}
          />
        </View>
      ) : (
        <ActionButton
          label="Cadastrar time"
          primary
          disabled={loading || loadFailed || busy}
          onPress={() => edit()}
        />
      )}
      {loading ? (
        <Text style={styles.text}>Carregando times…</Text>
      ) : loadFailed ? (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          Não foi possível carregar seus times.
        </Text>
      ) : teams.length === 0 ? (
        <Text style={styles.text}>
          Você ainda não tem times próprios ou seguidos.
        </Text>
      ) : (
        teams.map((team) => (
          <View key={team.id} style={styles.card}>
            <TeamIdentity
              name={team.name}
              description={`${team.sport} · ${team.category}`}
              current={team.id === session?.user.activeTeamId}
            />
            <Text style={styles.text}>
              {team.isOwner ? 'Criador' : 'Seguindo'}
              {team.isOwner && team.isFollowing ? ' · Seguindo' : ''}
            </Text>
            <Text style={styles.text}>{team.athletesCount ?? 0} atletas</Text>
            <ActionButton
              label={
                team.id === session?.user.activeTeamId
                  ? 'Abrir agenda'
                  : 'Escolher time'
              }
              primary
              disabled={busy || !!form}
              onPress={() => void choose(team.id)}
            />
            {team.isFollowing &&
              (confirmUnfollow === team.id ? (
                <View style={[styles.card, styles.highlighted]}>
                  <Text style={styles.text}>
                    {team.isOwner
                      ? 'Deixar de seguir este time? Você continuará com acesso como criador.'
                      : 'Deixar de seguir este time? Você perderá acesso aos jogos. Os dados do time serão preservados.'}
                  </Text>
                  <ActionButton
                    label="Confirmar deixar de seguir"
                    destructive
                    disabled={busy}
                    onPress={() => void leave(team)}
                  />
                  <ActionButton
                    label="Cancelar"
                    disabled={busy}
                    onPress={() => setConfirmUnfollow(undefined)}
                  />
                </View>
              ) : (
                <ActionButton
                  label="Deixar de seguir"
                  destructive
                  disabled={busy || !!form}
                  onPress={() => {
                    setConfirmDelete(undefined);
                    setConfirmUnfollow(team.id);
                  }}
                />
              ))}
            {team.isOwner && (
              <>
                {confirmDelete === team.id ? (
                  <>
                    <Text style={styles.text}>
                      Excluir este time permanentemente? Ele também será
                      removido dos seguidores e das seleções de agenda.
                    </Text>
                    <ActionButton
                      label="Confirmar exclusão"
                      destructive
                      disabled={busy}
                      onPress={() => void submit(team.id)}
                    />
                    <ActionButton
                      label="Cancelar exclusão"
                      disabled={busy}
                      onPress={() => setConfirmDelete(undefined)}
                    />
                  </>
                ) : (
                  <>
                    <ActionButton
                      label="Editar"
                      disabled={busy || !!form}
                      onPress={() => edit(team)}
                    />
                    <ActionButton
                      label="Excluir"
                      destructive
                      disabled={busy || !!form}
                      onPress={() => {
                        setConfirmUnfollow(undefined);
                        setConfirmDelete(team.id);
                      }}
                    />
                  </>
                )}
              </>
            )}
          </View>
        ))
      )}
      <ActionButton
        label={loadFailed ? 'Tentar novamente' : 'Atualizar lista'}
        disabled={busy || loading || !!form}
        onPress={() => {
          setLoading(true);
          setAttempt((value) => value + 1);
        }}
      />
    </HomeScreen>
  );
}
