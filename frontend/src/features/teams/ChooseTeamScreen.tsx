import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { FormInput } from '../../shared/components/FormInput';
import { surfaces as styles } from '../../shared/theme/surfaces';
import { TeamIdentity } from './TeamIdentity';
import { ApiError } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { ActionButton } from '../../shared/components/ActionButton';
import { HomeScreen } from '../home/components/HomeScreen';
import { useMatchResource } from '../matches/hooks';
import { searchTeams } from './api';

export function ChooseTeamScreen({
  token,
  mine = false,
}: {
  token: string;
  mine?: boolean;
}) {
  const router = useRouter();
  const { session, chooseTeam } = useAuth();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const pending = useRef(false);
  const [error, setError] = useState('');
  const load = useCallback(
    () => searchTeams(token, query, mine, cursor),
    [token, query, mine, cursor],
  );
  const { state, retry } = useMatchResource(load);

  async function choose(id: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(id);
    setError('');
    try {
      await chooseTeam(id);
      router.replace('/agenda');
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 404
          ? 'Este time não está mais disponível. Atualize a lista.'
          : 'Não foi possível salvar a escolha. Tente novamente.',
      );
    } finally {
      pending.current = false;
      setBusy(undefined);
    }
  }

  function search() {
    if (busy) return;
    setQuery(input.trim());
    setCursor(undefined);
    setError('');
    retry();
  }

  return (
    <HomeScreen
      title={mine ? 'Trocar time' : 'Buscar times'}
      standalone={mine}
      description={
        mine
          ? 'Escolha entre suas equipes e os times que você acompanha.'
          : 'Busque pelo nome. Sua última escolha será lembrada no próximo acesso.'
      }
    >
      <View style={styles.card}>
        <FormInput
          accessibilityLabel="Nome do time"
          placeholder="Nome do time"
          value={input}
          onChangeText={setInput}
          maxLength={100}
          editable={!busy}
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <ActionButton
          label="Buscar"
          onPress={search}
          disabled={!!busy}
          primary
          fullWidth
        />
      </View>
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {error}
        </Text>
      )}
      {state.status === 'loading' && (
        <Text style={styles.text}>Carregando times…</Text>
      )}
      {state.status === 'error' && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          Não foi possível carregar os times. Tente novamente.
        </Text>
      )}
      {state.status === 'ready' && (
        <>
          {state.data.data.length === 0 && (
            <Text style={styles.text}>Nenhum time encontrado.</Text>
          )}
          {state.data.data.map((team) => (
            <View key={team.id} style={styles.card}>
              <TeamIdentity
                name={team.name}
                description={`${team.sport} · ${team.category}`}
                current={team.id === session?.user.activeTeamId}
              />
              <ActionButton
                label={
                  busy === team.id
                    ? 'Salvando…'
                    : team.id === session?.user.activeTeamId
                      ? 'Abrir agenda'
                      : 'Escolher time'
                }
                primary
                disabled={!!busy}
                onPress={() => void choose(team.id)}
              />
            </View>
          ))}
          {state.data.nextCursor && (
            <ActionButton
              label="Próxima página"
              disabled={!!busy}
              onPress={() => setCursor(state.data.nextCursor!)}
            />
          )}
        </>
      )}
      {cursor && (
        <ActionButton
          label="Voltar ao início da lista"
          disabled={!!busy}
          onPress={() => setCursor(undefined)}
        />
      )}
      <ActionButton
        label="Atualizar lista"
        disabled={!!busy || state.status === 'loading'}
        onPress={retry}
      />
      {mine && (
        <ActionButton
          label="Buscar outros times"
          disabled={!!busy}
          onPress={() => router.replace('/buscar')}
        />
      )}
      <ActionButton
        label="Gerenciar minhas equipes"
        disabled={!!busy}
        onPress={() => router.navigate('/meus-times')}
      />
      {session?.user.activeTeamId && (
        <ActionButton
          label="Voltar à agenda"
          disabled={!!busy}
          onPress={() => router.replace('/agenda')}
        />
      )}
    </HomeScreen>
  );
}
