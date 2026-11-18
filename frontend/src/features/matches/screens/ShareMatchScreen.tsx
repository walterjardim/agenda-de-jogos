import * as Clipboard from 'expo-clipboard';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Share, Text, View } from 'react-native';
import { ApiError } from '../../auth/api';
import { ActionButton, HomeScreen } from '../../home/components/HomeScreen';
import { fetchMessage } from '../api';
import {
  LoadingMatches,
  MatchLoadError,
  styles,
} from '../components/MatchViews';
import {
  type AgendaTeam,
  useAgendaTeam,
  useMatchLoader,
  useMatchResource,
} from '../hooks';
import { type MessageType } from '../model';
import { previewMessage } from '../preview';

function Message({
  text,
  canSendLink,
}: {
  text: string;
  canSendLink: boolean;
}) {
  const [notice, setNotice] = useState('');

  async function copy() {
    try {
      if (!(await Clipboard.setStringAsync(text))) throw new Error();
      setNotice('Texto copiado.');
    } catch {
      setNotice(
        'Não foi possível copiar. Selecione o texto da prévia para copiá-lo.',
      );
    }
  }

  async function send() {
    try {
      if (canSendLink)
        await Linking.openURL(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
        );
      else await Share.share({ message: text });
    } catch {
      setNotice(
        'Não foi possível compartilhar. Você pode copiar o texto completo.',
      );
    }
  }

  return (
    <>
      <View style={styles.card}>
        <Text selectable style={styles.text}>
          {text}
        </Text>
      </View>
      {(canSendLink || Platform.OS !== 'web') && (
        <ActionButton
          label={canSendLink ? 'Enviar no WhatsApp' : 'Compartilhar texto'}
          primary
          onPress={() => void send()}
        />
      )}
      <ActionButton label="Copiar texto" onPress={() => void copy()} />
      {Boolean(notice) && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {notice}
        </Text>
      )}
    </>
  );
}

function ShareMatch({
  id,
  team,
  initialType,
}: {
  id: string;
  team: AgendaTeam;
  initialType: MessageType;
}) {
  const router = useRouter();
  const [type, setType] = useState(initialType);
  const loadMatch = useMatchLoader(id, team);
  const { token, timezone } = team;
  const load = useCallback(async () => {
    const match = await loadMatch();
    if (!match) return null;
    const message = token
      ? await fetchMessage(id, token, type)
      : { text: previewMessage(match, timezone, type) };
    const { text } = message;
    const canSendLink =
      (!('whatsappUrl' in message) || message.whatsappUrl !== null) &&
      Array.from(text).length <= 2000;
    return { type, text, canSendLink };
  }, [id, loadMatch, timezone, token, type]);
  const { state, retry } = useMatchResource(load);
  const emptyCallup =
    state.status === 'error' &&
    state.error instanceof ApiError &&
    state.error.status === 422 &&
    type === 'callup';

  return (
    <HomeScreen title="Prévia do compartilhamento" standalone>
      <View style={styles.row}>
        <ActionButton
          label="Ficha"
          primary={type === 'sheet'}
          onPress={() => setType('sheet')}
        />
        <ActionButton
          label="Convocação"
          primary={type === 'callup'}
          onPress={() => setType('callup')}
        />
      </View>
      {state.status === 'loading' && <LoadingMatches />}
      {state.status === 'error' && !emptyCallup && (
        <MatchLoadError error={state.error} retry={retry} />
      )}
      {state.status === 'ready' && !state.data && (
        <Text style={styles.text}>Jogo indisponível.</Text>
      )}
      {(emptyCallup ||
        (state.status === 'ready' &&
          state.data?.type === type &&
          !state.data.text)) && (
        <Text style={styles.text}>
          Selecione pelo menos um atleta para compartilhar a convocação.
        </Text>
      )}
      {state.status === 'ready' &&
        state.data?.type === type &&
        Boolean(state.data.text) && (
          <Message
            key={type}
            text={state.data.text}
            canSendLink={state.data.canSendLink}
          />
        )}
      <ActionButton
        label="Voltar à ficha"
        onPress={() =>
          router.dismissTo({ pathname: '/jogo/[id]', params: { id } })
        }
      />
    </HomeScreen>
  );
}

export function ShareMatchScreen() {
  const { id, type } = useLocalSearchParams<{
    id: string;
    type?: MessageType;
  }>();
  const team = useAgendaTeam();
  if (!team || !id) return <Redirect href="/buscar" />;
  return (
    <ShareMatch
      key={`${id}:${team.id}`}
      id={id}
      team={team}
      initialType={type === 'callup' ? 'callup' : 'sheet'}
    />
  );
}
