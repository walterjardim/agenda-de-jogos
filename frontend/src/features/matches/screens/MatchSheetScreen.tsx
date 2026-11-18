import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ApiError } from '../../auth/api';
import { useAuth } from '../../auth/AuthContext';
import { ActionButton, HomeScreen } from '../../home/components/HomeScreen';
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

function MatchSheet({ id, team }: { id: string; team: AgendaTeam }) {
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
          <ActionButton
            label="Editar jogo"
            disabled={confirming}
            onPress={() =>
              router.push({ pathname: '/editar-jogo/[id]', params: { id } })
            }
          />
          <View style={styles.card}>
            <Text style={styles.text}>
              {match.competition ? `${match.competition.name} · ` : ''}
              {match.isHome ? 'Casa' : 'Fora'}
            </Text>
            <Text style={styles.label}>
              Jogo · {formatGameTime(match.startsAt, timezone)}
            </Text>
            <Text style={styles.text}>
              Chegada · {formatGameTime(match.arrivalAt, timezone)}
            </Text>
            {Boolean(match.location) && (
              <Text style={styles.text}>Local · {match.location}</Text>
            )}
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
          <ActionButton
            label="Compartilhar ficha no WhatsApp"
            primary
            disabled={confirming}
            onPress={() =>
              router.push({
                pathname: '/compartilhar/[id]',
                params: { id, type: 'sheet' },
              })
            }
          />
          <ActionButton
            label="Selecionar atletas"
            disabled={confirming}
            onPress={() =>
              router.push({ pathname: '/convocacao/[id]', params: { id } })
            }
          />
          {confirming ? (
            <View style={styles.card}>
              <Text style={styles.label}>
                Excluir este jogo e sua convocação?
              </Text>
              {Boolean(error) && (
                <Text accessibilityLiveRegion="polite" style={styles.error}>
                  {error}
                </Text>
              )}
              <View style={styles.row}>
                <ActionButton
                  label={deleting ? 'Excluindo…' : 'Confirmar exclusão'}
                  primary
                  disabled={deleting}
                  onPress={() => void remove()}
                />
                <ActionButton
                  label="Cancelar exclusão"
                  disabled={deleting}
                  onPress={() => {
                    setConfirming(false);
                    setError('');
                    retry();
                  }}
                />
              </View>
            </View>
          ) : (
            <ActionButton
              label="Excluir jogo"
              onPress={() => setConfirming(true)}
            />
          )}
        </>
      )}
      <ActionButton
        label="Voltar à agenda"
        disabled={deleting}
        onPress={() => router.dismissTo('/agenda')}
      />
    </HomeScreen>
  );
}

export function MatchSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const team = useAgendaTeam();
  if (!team || !id) return <Redirect href="/buscar" />;
  return <MatchSheet key={`${id}:${team.id}`} id={id} team={team} />;
}
