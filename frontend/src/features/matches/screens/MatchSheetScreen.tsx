import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentRef, useCallback, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { surfaces } from '../../../shared/theme/surfaces';
import { ApiError } from '../../auth/api';
import { useAuth } from '../../auth/AuthContext';
import { ActionButton } from '../../../shared/components/ActionButton';
import { HomeScreen } from '../../home/components/HomeScreen';
import { usePreview } from '../../home/PreviewContext';
import { deleteMatch, fetchTeam } from '../api';
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
import { formatFee, formatGameTime, pieceLabel } from '../model';
import { previewTeam } from '../preview';

function MatchSheet({
  id,
  team,
  fromPreview,
}: {
  id: string;
  team: AgendaTeam;
  fromPreview: boolean;
}) {
  const router = useRouter();
  const { changePreviewMatch } = usePreview();
  const { invalidateSession } = useAuth();
  const { token, id: teamId, timezone } = team;
  const loadMatch = useMatchLoader(id, team);
  const load = useCallback(async () => {
    const [match, selectedTeam] = await Promise.all([
      loadMatch(),
      token ? fetchTeam(teamId, token) : previewTeam,
    ]);
    return match ? { match, selectedTeam } : null;
  }, [loadMatch, teamId, token]);
  const { state, retry } = useMatchResource(load);
  const data = state.status === 'ready' ? state.data : null;
  const match = data?.match;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const deleteButton = useRef<ComponentRef<typeof Pressable>>(null);
  const cancelButton = useRef<ComponentRef<typeof Pressable>>(null);

  function focusButton(button: ComponentRef<typeof Pressable> | null) {
    if (!button) return;
    if (Platform.OS === 'web') button.focus();
    else AccessibilityInfo.sendAccessibilityEvent(button, 'focus');
  }

  function cancelDeletion() {
    if (pending.current) return;
    setConfirming(false);
    setError('');
    if (error) retry();
    if (Platform.OS === 'android') {
      requestAnimationFrame(() => focusButton(deleteButton.current));
    }
  }

  async function remove() {
    if (pending.current) return;
    pending.current = true;
    setDeleting(true);
    setError('');
    try {
      if (token) await deleteMatch(id, token);
      else changePreviewMatch(id, () => null);
      router.dismissTo('/agenda');
    } catch (error) {
      if (token && error instanceof ApiError && error.status === 401) {
        await invalidateSession(token);
      } else {
        setError(
          'Não foi possível confirmar a exclusão. Atualize a ficha antes de tentar novamente.',
        );
      }
    } finally {
      pending.current = false;
      setDeleting(false);
    }
  }

  return (
    <HomeScreen
      title="Ficha do jogo"
      description={
        match &&
        (data?.selectedTeam
          ? `${data.selectedTeam.name} × ${match.opponent}`
          : match.opponent)
      }
      standalone
      onBack={() => {
        if (fromPreview && router.canGoBack()) router.back();
        else router.dismissTo('/agenda');
      }}
      backDisabled={deleting}
    >
      {state.status === 'loading' && <LoadingMatches />}
      {state.status === 'error' && (
        <MatchLoadError error={state.error} retry={retry} />
      )}
      {state.status === 'ready' && !match && (
        <Text style={styles.text}>Jogo indisponível.</Text>
      )}
      {match && (
        <>
          <View style={[styles.card, styles.highlighted]}>
            <Text style={styles.text}>
              {match.competition ? `${match.competition.name} · ` : ''}
              {match.isHome ? 'Casa' : 'Fora'}
            </Text>
            <Text style={styles.title}>
              Jogo · {formatGameTime(match.startsAt, timezone)}
            </Text>
            <Text style={styles.label}>
              Chegada · {formatGameTime(match.arrivalAt, timezone)}
            </Text>
            {Boolean(match.location) && (
              <Text style={styles.text}>Local · {match.location}</Text>
            )}
          </View>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>
              Informações do jogo
            </Text>
            {match.shirtPiece && (
              <Text style={styles.text}>
                Camisa · {pieceLabel(match.shirtPiece)}
              </Text>
            )}
            {match.shortsPiece && (
              <Text style={styles.text}>
                Calção · {pieceLabel(match.shortsPiece)}
              </Text>
            )}
            {match.socksPiece && (
              <Text style={styles.text}>
                Meião · {pieceLabel(match.socksPiece)}
              </Text>
            )}
            {match.refereeFeeCents !== null && (
              <Text style={styles.text}>
                Taxa por atleta · {formatFee(match.refereeFeeCents)}
              </Text>
            )}
            {Boolean(match.notes) && (
              <Text style={styles.text}>{match.notes}</Text>
            )}
            <Text style={styles.label}>Convocados · {match.callupsCount}</Text>
          </View>
          <View style={styles.row}>
            <ActionButton
              icon="share"
              label="Compartilhar ficha"
              primary
              disabled={confirming}
              onPress={() =>
                router.push({
                  pathname: '/compartilhar/[id]',
                  params: { id, type: 'sheet' },
                })
              }
            />
            {data.selectedTeam.isOwner && (
              <ActionButton
                icon="teams"
                label="Selecionar atletas"
                disabled={confirming}
                onPress={() =>
                  router.push({ pathname: '/convocacao/[id]', params: { id } })
                }
              />
            )}
          </View>
          {data.selectedTeam.isOwner && (
            <>
              <View style={styles.row}>
                <ActionButton
                  icon="edit"
                  label="Editar jogo"
                  disabled={confirming}
                  onPress={() =>
                    router.push({
                      pathname: '/editar-jogo/[id]',
                      params: { id },
                    })
                  }
                />
                <ActionButton
                  ref={deleteButton}
                  icon="remove"
                  label="Excluir jogo"
                  destructive
                  onPress={() => setConfirming(true)}
                />
              </View>
              <Modal
                transparent
                visible={confirming}
                onRequestClose={cancelDeletion}
                onShow={() => focusButton(cancelButton.current)}
                onDismiss={() => focusButton(deleteButton.current)}
                aria-labelledby="delete-match-title"
              >
                <ScrollView contentContainerStyle={dialogStyles.overlay}>
                  <View
                    accessibilityViewIsModal
                    style={[surfaces.card, dialogStyles.card]}
                  >
                    <Text
                      nativeID="delete-match-title"
                      accessibilityRole="header"
                      style={styles.title}
                    >
                      Excluir jogo?
                    </Text>
                    <Text style={styles.text}>
                      O jogo e sua convocação serão removidos da agenda para
                      todas as pessoas que acompanham o time.
                    </Text>
                    {Boolean(error) && (
                      <Text
                        accessibilityLiveRegion="polite"
                        aria-live="polite"
                        style={styles.error}
                      >
                        {error}
                      </Text>
                    )}
                    <View style={styles.row}>
                      <ActionButton
                        ref={cancelButton}
                        label="Cancelar"
                        disabled={deleting}
                        onPress={cancelDeletion}
                      />
                      <ActionButton
                        icon="remove"
                        label={deleting ? 'Excluindo…' : 'Excluir jogo'}
                        destructive
                        disabled={deleting}
                        onPress={() => void remove()}
                      />
                    </View>
                  </View>
                </ScrollView>
              </Modal>
            </>
          )}
        </>
      )}
    </HomeScreen>
  );
}

export function MatchSheetScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: 'preview' }>();
  const team = useAgendaTeam();
  if (!team || !id) return <Redirect href="/buscar" />;
  return (
    <MatchSheet
      fromPreview={from === 'preview'}
      key={`${id}:${team.id}`}
      id={id}
      team={team}
    />
  );
}

const dialogStyles = StyleSheet.create({
  overlay: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  card: { width: '100%', maxWidth: 440 },
});
