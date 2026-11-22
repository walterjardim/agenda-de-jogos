import * as Clipboard from 'expo-clipboard';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../../../shared/theme/theme';
import { ApiError } from '../../auth/api';
import { ActionButton } from '../../../shared/components/ActionButton';
import { HomeScreen } from '../../home/components/HomeScreen';
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
  whatsappUrl,
  onBack,
}: {
  text: string;
  whatsappUrl: string | null;
  onBack: () => void;
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
      if (whatsappUrl) await Linking.openURL(whatsappUrl);
      else await Share.share({ message: text });
    } catch {
      setNotice(
        'Não foi possível compartilhar. Você pode copiar o texto completo.',
      );
    }
  }

  return (
    <>
      <View style={[styles.card, styles.highlighted]}>
        <Text selectable style={styles.text}>
          {text}
        </Text>
      </View>
      {!whatsappUrl && (
        <Text style={styles.text}>
          O texto ultrapassa 2.000 caracteres.{' '}
          {Platform.OS === 'web'
            ? 'Copie o conteúdo completo para compartilhar.'
            : 'Use o compartilhamento do dispositivo ou copie o conteúdo completo.'}
        </Text>
      )}
      <View style={styles.row}>
        {(whatsappUrl || Platform.OS !== 'web') && (
          <ActionButton
            icon="share"
            label={whatsappUrl ? 'Enviar no WhatsApp' : 'Compartilhar texto'}
            primary
            onPress={() => void send()}
          />
        )}
        <ActionButton
          icon="copy"
          label="Copiar texto"
          onPress={() => void copy()}
        />
        <ActionButton icon="back" label="Voltar à ficha" onPress={onBack} />
      </View>
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
    if (token) {
      const message = await fetchMessage(id, token, type);
      return { type, text: message.text, whatsappUrl: message.whatsappUrl };
    }
    const text = previewMessage(match, timezone, type);
    return {
      type,
      text,
      whatsappUrl:
        Array.from(text).length <= 2000
          ? `https://wa.me/?text=${encodeURIComponent(text)}`
          : null,
    };
  }, [id, loadMatch, timezone, token, type]);
  const { state, retry } = useMatchResource(load);
  const emptyCallup =
    state.status === 'error' &&
    state.error instanceof ApiError &&
    state.error.status === 422 &&
    type === 'callup';

  return (
    <HomeScreen title="Prévia do compartilhamento" standalone>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Tipo de mensagem"
        style={shareStyles.segments}
      >
        {(
          [
            ['sheet', 'Ficha'],
            ['callup', 'Convocação'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            aria-checked={type === value}
            accessibilityState={{ checked: type === value }}
            onPress={() => setType(value)}
            style={({ pressed }) => [
              shareStyles.option,
              type === value && shareStyles.active,
              pressed && shareStyles.pressed,
            ]}
          >
            <Text
              style={[
                shareStyles.label,
                type === value && shareStyles.activeLabel,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
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
        <View style={styles.card}>
          <Text style={styles.text}>
            Selecione pelo menos um atleta para compartilhar a convocação.
          </Text>
          <ActionButton
            primary
            label="Montar convocação"
            onPress={() =>
              router.dismissTo({ pathname: '/convocacao/[id]', params: { id } })
            }
          />
        </View>
      )}
      {state.status === 'ready' &&
        state.data?.type === type &&
        Boolean(state.data.text) && (
          <Message
            key={type}
            text={state.data.text}
            whatsappUrl={state.data.whatsappUrl}
            onBack={() =>
              router.dismissTo({ pathname: '/jogo/[id]', params: { id } })
            }
          />
        )}
      {!(
        state.status === 'ready' &&
        state.data?.type === type &&
        state.data.text
      ) && (
        <ActionButton
          icon="back"
          label="Voltar à ficha"
          onPress={() =>
            router.dismissTo({ pathname: '/jogo/[id]', params: { id } })
          }
        />
      )}
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

const shareStyles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: theme.colors.accentSurface,
  },
  option: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    padding: 8,
    borderRadius: 10,
  },
  active: { backgroundColor: theme.colors.accent },
  pressed: { opacity: 0.75 },
  label: {
    color: theme.colors.accent,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  activeLabel: { color: theme.colors.white },
});
