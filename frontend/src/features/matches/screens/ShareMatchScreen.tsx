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
import { fetchMessage, fetchTeam } from '../api';
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

function whatsappLink(text: string) {
  return Array.from(text).length <= 2000
    ? `https://wa.me/?text=${encodeURIComponent(text)}`
    : null;
}

function Message({
  text,
  whatsappUrl,
}: {
  text: string;
  whatsappUrl: string | null;
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
      <View style={styles.actions}>
        {(whatsappUrl || Platform.OS !== 'web') && (
          <ActionButton
            icon="share"
            label={whatsappUrl ? 'Enviar no WhatsApp' : 'Compartilhar texto'}
            primary
            fullWidth
            onPress={() => void send()}
          />
        )}
        <ActionButton
          icon="copy"
          label="Copiar texto"
          primary={!whatsappUrl && Platform.OS === 'web'}
          fullWidth
          onPress={() => void copy()}
        />
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
  fromAgenda,
}: {
  id: string;
  team: AgendaTeam;
  initialType: MessageType;
  fromAgenda: boolean;
}) {
  const router = useRouter();
  const [requestedType, setType] = useState(initialType);
  const loadMatch = useMatchLoader(id, team);
  const { token, timezone } = team;
  const loadPermissions = useCallback(
    async () => !token || (await fetchTeam(team.id, token)).isOwner === true,
    [team.id, token],
  );
  const permissions = useMatchResource(loadPermissions, true);
  const canShareCallup =
    !token || (permissions.state.status === 'ready' && permissions.state.data);
  const waitingForPermissions =
    Boolean(token) && permissions.state.status === 'loading';
  const type = canShareCallup ? requestedType : 'sheet';
  const load = useCallback(async () => {
    if (waitingForPermissions) return undefined;
    const match = await loadMatch();
    if (!match) return { type, message: null };

    let text = '';
    if (token) {
      try {
        text = (await fetchMessage(id, token, type)).text;
      } catch (error) {
        if (!(
          type === 'callup' &&
          error instanceof ApiError &&
          error.status === 422
        )) {
          throw error;
        }
      }
    } else {
      text = previewMessage(match, timezone, type);
    }

    return { type, message: { text, whatsappUrl: whatsappLink(text) } };
  }, [id, loadMatch, timezone, token, type, waitingForPermissions]);
  const { state, retry } = useMatchResource(load);
  const current =
    !waitingForPermissions &&
    state.status === 'ready' &&
    state.data?.type === type
      ? state.data
      : null;
  const message = current?.message;

  return (
    <HomeScreen
      title="Prévia do compartilhamento"
      standalone
      compactHeader
      onBack={() => {
        if (fromAgenda) router.dismissTo('/agenda');
        else router.dismissTo({ pathname: '/jogo/[id]', params: { id } });
      }}
    >
      {canShareCallup && (
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
      )}
      {!current && state.status !== 'error' && <LoadingMatches />}
      {state.status === 'error' && (
        <MatchLoadError error={state.error} retry={retry} />
      )}
      {current && !message && (
        <Text style={styles.text}>Jogo indisponível.</Text>
      )}
      {type === 'callup' && message && !message.text && (
        <View style={styles.card}>
          <Text style={styles.text}>
            Selecione pelo menos um atleta para compartilhar a convocação.
          </Text>
          <ActionButton
            icon="teams"
            primary
            fullWidth
            label="Selecionar atletas"
            onPress={() =>
              router.push({
                pathname: '/convocacao/[id]',
                params: { id, from: 'preview' },
              })
            }
          />
        </View>
      )}
      {message?.text && (
        <Message
          key={type}
          text={message.text}
          whatsappUrl={message.whatsappUrl}
        />
      )}
      {fromAgenda && message && (
        <ActionButton
          label="Detalhes do jogo"
          fullWidth
          onPress={() =>
            router.push({
              pathname: '/jogo/[id]',
              params: { id, from: 'preview' },
            })
          }
        />
      )}
    </HomeScreen>
  );
}

export function ShareMatchScreen() {
  const { id, type, from } = useLocalSearchParams<{
    id: string;
    type?: MessageType;
    from?: 'agenda';
  }>();
  const team = useAgendaTeam();
  if (!team || !id) return <Redirect href="/buscar" />;
  return (
    <ShareMatch
      key={`${id}:${team.id}`}
      id={id}
      team={team}
      fromAgenda={from === 'agenda'}
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
    minHeight: 48,
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
