import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../shared/theme/theme';
import { ApiError } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { ActionButton, HomeScreen } from '../home/components/HomeScreen';
import {
  deleteTeam,
  listOwnedTeams,
  saveTeam,
  type Team,
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
  const { invalidateSession, clearDeletedTeam } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<TeamInput | null>(null);
  const [editingId, setEditingId] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<string>();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    listOwnedTeams(token)
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
  }, [token, attempt, invalidateSession]);

  function edit(team?: Team) {
    setEditingId(team?.id);
    setForm(
      team
        ? { name: team.name, sport: team.sport, category: team.category }
        : empty,
    );
    setConfirmDelete(undefined);
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
          [...items.filter((item) => item.id !== saved.id), saved].sort(
            (a, b) => a.name.localeCompare(b.name),
          ),
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

  return (
    <HomeScreen
      title="Meus times"
      description="Cadastre e gerencie as equipes que você administra."
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
            <View key={key} style={styles.field}>
              <Text style={styles.text}>{label}</Text>
              <TextInput
                accessibilityLabel={label}
                value={form[key]}
                maxLength={limit}
                editable={!busy}
                style={styles.input}
                onChangeText={(value) =>
                  setForm((current) => current && { ...current, [key]: value })
                }
              />
            </View>
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
        <Text style={styles.text}>Você ainda não cadastrou nenhum time.</Text>
      ) : (
        teams.map((team) => (
          <View key={team.id} style={styles.card}>
            <Text style={styles.title}>{team.name}</Text>
            <Text style={styles.text}>
              {team.sport} · {team.category}
            </Text>
            {confirmDelete === team.id ? (
              <>
                <Text style={styles.text}>
                  Excluir este time permanentemente? Ele também será removido
                  dos seguidores e das seleções de agenda.
                </Text>
                <ActionButton
                  label="Confirmar exclusão"
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
                  disabled={busy || !!form}
                  onPress={() => setConfirmDelete(team.id)}
                />
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

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: theme.colors.white,
  },
  field: { gap: 6 },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  text: { color: theme.colors.muted, fontSize: 16, lineHeight: 23 },
  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    color: theme.colors.text,
    fontSize: 16,
  },
});
