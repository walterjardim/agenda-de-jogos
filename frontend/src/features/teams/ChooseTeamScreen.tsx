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
import { followTeam, searchTeams } from './api';

export function ChooseTeamScreen({
  token,
  mine = false,
}: {
  token: string;
  mine?: boolean;
}) {
  const router = useRouter();
  const { session, chooseTeam, invalidateSession } = useAuth();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<string>();
  const [followTarget, setFollowTarget] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const pending = useRef(false);
  const [error, setError] = useState('');
  const load = useCallback(
    () => searchTeams(token, query, mine, cursor),
    [token, query, mine, cursor],
  );
  const { state, retry, refreshing } = useMatchResource(load, true);
  const firstTeam = !session?.user.activeTeamId && !mine;

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

  async function follow(id: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(id);
    setError('');
    try {
      await followTeam(token, id);
      retry();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401)
        await invalidateSession(token);
      else
        setError(
          cause instanceof ApiError && cause.status === 404
            ? 'Este time não está mais disponível. Atualize a lista.'
            : 'Não foi possível confirmar o seguimento. Atualize a lista e tente novamente.',
        );
    } finally {
      pending.current = false;
      setBusy(undefined);
    }
  }

  function search() {
    if (busy || (!mine && input.trim().length < 2)) return;
    setQuery(input.trim());
    setCursor(undefined);
    setError('');
    retry();
  }

  return (
    <HomeScreen
      title={mine ? 'Trocar time' : 'Buscar times'}
      standalone={mine}
      onBack={
        mine
          ? () =>
              router.canGoBack() ? router.back() : router.replace('/agenda')
          : undefined
      }
      backDisabled={!!busy}
      description={
        mine
          ? 'Escolha entre suas equipes e os times que você acompanha.'
          : 'Encontre um time pelo nome e siga para acessar seus jogos.'
      }
    >
      {firstTeam && (
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
      <View style={styles.card}>
        <FormInput
          accessibilityLabel="Nome do time"
          placeholder="Nome do time"
          value={input}
          onChangeText={setInput}
          maxLength={80}
          editable={!busy}
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <ActionButton
          icon="search"
          label="Buscar"
          onPress={search}
          disabled={!!busy || (!mine && input.trim().length < 2)}
          primary
          fullWidth
        />
      </View>
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {error}
        </Text>
      )}
      {(state.status === 'loading' || refreshing) && (
        <Text style={styles.text}>Carregando times…</Text>
      )}
      {state.status === 'error' && (
        <View style={styles.card}>
          <Text accessibilityLiveRegion="polite" style={styles.text}>
            Não foi possível carregar os times.
          </Text>
          <ActionButton label="Tentar novamente" onPress={retry} />
        </View>
      )}
      {state.status === 'ready' && (
        <>
          {!mine && query.length < 2 && (
            <Text style={styles.text}>
              Digite pelo menos 2 caracteres para buscar.
            </Text>
          )}
          {(mine || query.length >= 2) && state.data.data.length === 0 && (
            <Text style={styles.text}>Nenhum time encontrado.</Text>
          )}
          {state.data.data.map((team) => (
            <View key={team.id} style={styles.card}>
              <TeamIdentity
                name={team.name}
                description={`${team.sport} · ${team.category}`}
                current={team.id === session?.user.activeTeamId}
              />
              <Text style={styles.text}>
                {team.isOwner
                  ? 'Criador'
                  : team.isFollowing
                    ? 'Seguindo'
                    : 'Você ainda não segue este time.'}
              </Text>
              {team.isOwner || team.isFollowing ? (
                <ActionButton
                  icon="save"
                  label={
                    busy === team.id
                      ? 'Salvando…'
                      : team.id === session?.user.activeTeamId
                        ? 'Abrir agenda'
                        : 'Escolher time'
                  }
                  disabled={!!busy}
                  onPress={() => void choose(team.id)}
                />
              ) : (
                <ActionButton
                  icon="follow"
                  label={busy === team.id ? 'Seguindo…' : 'Seguir'}
                  disabled={!!busy}
                  onPress={() => setFollowTarget(team.id)}
                />
              )}
              {followTarget === team.id && (
                <View style={styles.row}>
                  <Text style={styles.text}>
                    Ao seguir, você pode acompanhar os jogos deste time.
                  </Text>
                  <ActionButton
                    label="Confirmar que quero seguir"
                    primary
                    disabled={!!busy}
                    onPress={() => {
                      setFollowTarget(undefined);
                      void follow(team.id);
                    }}
                  />
                  <ActionButton
                    label="Cancelar"
                    onPress={() => setFollowTarget(undefined)}
                  />
                </View>
              )}
            </View>
          ))}
          {state.data.nextCursor && (
            <ActionButton
              icon="chevron"
              label="Próxima página"
              disabled={!!busy}
              onPress={() => setCursor(state.data.nextCursor!)}
            />
          )}
        </>
      )}
      <View style={styles.row}>
        {cursor && (
          <ActionButton
            icon="back"
            label="Voltar ao início da lista"
            disabled={!!busy}
            onPress={() => setCursor(undefined)}
          />
        )}
        <ActionButton
          icon="refresh"
          label="Atualizar lista"
          disabled={!!busy || refreshing || state.status === 'loading'}
          onPress={retry}
        />
        {mine && (
          <ActionButton
            icon="search"
            label="Buscar outros times"
            disabled={!!busy}
            onPress={() => router.replace('/buscar')}
          />
        )}
        <ActionButton
          icon="teams"
          label="Gerenciar minhas equipes"
          disabled={!!busy}
          onPress={() => router.navigate('/meus-times')}
        />
        {!mine && session?.user.activeTeamId && (
          <ActionButton
            icon="back"
            label="Voltar à agenda"
            disabled={!!busy}
            onPress={() => router.replace('/agenda')}
          />
        )}
      </View>
    </HomeScreen>
  );
}
