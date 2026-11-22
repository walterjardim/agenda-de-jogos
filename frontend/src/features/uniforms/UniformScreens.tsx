import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ActionButton } from '../../shared/components/ActionButton';
import { TableActions } from '../../shared/components/TableActions';
import { tableStyles } from '../../shared/theme/table';
import { FormField } from '../../shared/components/FormInput';
import { theme } from '../../shared/theme/theme';
import { ApiError } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { HomeScreen } from '../home/components/HomeScreen';
import { usePreview } from '../home/PreviewContext';
import { fetchTeam, fetchUniforms } from '../matches/api';
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
import type { PieceType, UniformPiece } from '../matches/model';
import { previewTeam } from '../matches/preview';
import { deleteUniform, saveUniform, type UniformInput } from './api';

const labels: Record<PieceType, string> = {
  shirt: 'Camisa',
  shorts: 'Calção',
  socks: 'Meião',
};
const types = Object.entries(labels).map(([id, label]) => ({ id, label }));
const palette = [
  { color: '#1E40AF', name: 'Azul' },
  { color: '#E2222B', name: 'Vermelho' },
  { color: '#FFFFFF', name: 'Branco' },
  { color: '#000000', name: 'Preto' },
  { color: '#15803D', name: 'Verde' },
  { color: '#FACC15', name: 'Amarelo' },
];

function useUniforms(team: AgendaTeam) {
  const { previewUniforms } = usePreview();
  const { id, token } = team;
  const load = useCallback(async () => {
    const [details, uniforms] = token
      ? await Promise.all([fetchTeam(id, token), fetchUniforms(id, token)])
      : [previewTeam, previewUniforms];
    return { team: details, uniforms };
  }, [id, token, previewUniforms]);
  return useMatchResource(load);
}

function PieceCard({
  piece,
  compact = false,
}: {
  piece: UniformPiece;
  compact?: boolean;
}) {
  return (
    <View style={local.piece}>
      <View
        accessibilityLabel={`Cor ${piece.description}`}
        style={[local.swatch, { backgroundColor: piece.colorHex }]}
      />
      <View style={local.details}>
        <Text style={compact ? styles.label : styles.title}>
          {labels[piece.pieceType]} · {piece.uniformName}
        </Text>
        <Text style={compact ? tableStyles.position : styles.text}>
          {piece.description}
        </Text>
        {(piece.isHomeDefault || piece.isAwayDefault) && (
          <Text style={local.defaultText}>
            {piece.isHomeDefault && piece.isAwayDefault
              ? 'Padrão casa e fora'
              : piece.isHomeDefault
                ? 'Padrão casa'
                : 'Padrão fora'}
          </Text>
        )}
      </View>
    </View>
  );
}

function UniformList({ team }: { team: AgendaTeam }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null);
  const [removing, setRemoving] = useState<UniformPiece | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const { deletePreviewUniform } = usePreview();
  const { invalidateSession } = useAuth();
  const { state, retry } = useUniforms(team);
  const data = state.status === 'ready' ? state.data : null;
  const pieces = data?.uniforms.filter(
    (piece) => !filter || piece.pieceType === filter,
  );
  async function remove() {
    if (!removing || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (team.token) await deleteUniform(team.token, removing.id);
      else deletePreviewUniform(removing.id);
      setRemoving(null);
      retry();
    } catch (failure) {
      if (team.token && failure instanceof ApiError && failure.status === 401)
        await invalidateSession(team.token);
      else
        setError(
          failure instanceof ApiError && failure.status === 403
            ? 'Somente o criador do time pode remover uniformes.'
            : failure instanceof ApiError && failure.status === 404
              ? 'Peça indisponível. Atualize a lista.'
              : 'Não foi possível confirmar a remoção. Confira a conexão e atualize a lista antes de tentar novamente.',
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <HomeScreen
      title="Uniformes"
      description={data?.team.name}
      standalone
      onBack={() =>
        router.canGoBack() ? router.back() : router.dismissTo('/agenda')
      }
      backDisabled={busy}
    >
      <SelectField
        label="Peças"
        options={[{ id: null, label: 'Todas as peças' }, ...types]}
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setRemoving(null);
          setError('');
        }}
        disabled={busy}
      />
      {state.status === 'loading' && <LoadingMatches />}
      {state.status === 'error' && (
        <MatchLoadError error={state.error} retry={retry} />
      )}
      {pieces?.length === 0 && (
        <Text style={styles.text}>Nenhuma peça cadastrada.</Text>
      )}
      {pieces && pieces.length > 0 && (
        <View
          role="table"
          accessibilityLabel="Uniformes do time"
          style={tableStyles.table}
        >
          <View role="row" style={[tableStyles.row, tableStyles.header]}>
            <Text
              role="columnheader"
              style={[tableStyles.heading, tableStyles.player]}
            >
              Peça
            </Text>
            {data?.team.isOwner === true && (
              <Text
                role="columnheader"
                style={[tableStyles.heading, tableStyles.actions]}
              >
                Ações
              </Text>
            )}
          </View>
          {pieces.map((piece) => (
            <View key={piece.id} role="rowgroup" style={tableStyles.record}>
              <View role="row" style={tableStyles.row}>
                <View role="cell" style={tableStyles.player}>
                  <PieceCard piece={piece} compact />
                </View>
                {data?.team.isOwner === true && (
                  <TableActions
                    itemName={`${labels[piece.pieceType].toLowerCase()} ${piece.uniformName}`}
                    disabled={busy}
                    onEdit={() =>
                      router.push({
                        pathname: '/uniforme',
                        params: { id: piece.id },
                      })
                    }
                    onRemove={() => {
                      setRemoving(piece);
                      setError('');
                    }}
                  />
                )}
              </View>
              {removing?.id === piece.id && (
                <View style={tableStyles.confirmation}>
                  <Text style={styles.label}>
                    Remover {labels[piece.pieceType].toLowerCase()}{' '}
                    {piece.uniformName}? Os jogos que a utilizam ficarão sem
                    essa peça.
                  </Text>
                  {!!error && (
                    <View style={styles.field}>
                      <Text
                        accessibilityLiveRegion="polite"
                        style={styles.error}
                      >
                        {error}
                      </Text>
                      <ActionButton
                        icon="refresh"
                        label="Atualizar lista"
                        disabled={busy}
                        onPress={retry}
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
      )}
      <View style={styles.row}>
        {data?.team.isOwner === true && (
          <ActionButton
            icon="add"
            label="Nova peça"
            disabled={busy}
            primary
            onPress={() => router.push('/uniforme')}
          />
        )}
      </View>
    </HomeScreen>
  );
}

function UniformForm({
  team,
  piece,
}: {
  team: AgendaTeam;
  piece?: UniformPiece;
}) {
  const router = useRouter();
  const { savePreviewUniform, deletePreviewUniform } = usePreview();
  const { invalidateSession } = useAuth();
  const [input, setInput] = useState<UniformInput>(() =>
    piece
      ? {
          pieceType: piece.pieceType,
          uniformName: piece.uniformName,
          description: piece.description,
          colorHex: piece.colorHex,
          isHomeDefault: piece.isHomeDefault,
          isAwayDefault: piece.isAwayDefault,
        }
      : {
          pieceType: 'shirt',
          uniformName: '',
          description: '',
          colorHex: '#000000',
          isHomeDefault: false,
          isAwayDefault: false,
        },
  );
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [customColor, setCustomColor] = useState(false);
  const [fieldError, setFieldError] = useState<{
    field: 'uniformName' | 'description' | 'colorHex';
    message: string;
  }>();
  const uniformNameRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const colorHexRef = useRef<TextInput>(null);
  const pending = useRef(false);
  function change<K extends keyof UniformInput>(
    key: K,
    value: UniformInput[K],
  ) {
    if (fieldError?.field === key) setFieldError(undefined);
    setInput((current) => ({ ...current, [key]: value }));
  }
  async function submit(remove: boolean) {
    if (pending.current) return;
    const body = {
      ...input,
      uniformName: input.uniformName.trim(),
      description: input.description.trim(),
      colorHex: input.colorHex.trim(),
    };
    if (!remove) {
      const invalid = !body.uniformName
        ? ({
            field: 'uniformName',
            message: 'Informe uma identificação, como Uniforme principal.',
          } as const)
        : !body.description
          ? ({
              field: 'description',
              message: 'Informe o nome da cor, como Azul.',
            } as const)
          : !/^#[0-9a-fA-F]{6}$/.test(body.colorHex)
            ? ({
                field: 'colorHex',
                message: 'Use o formato hexadecimal, como #1E40AF.',
              } as const)
            : undefined;
      if (invalid) {
        setError('');
        setFieldError(invalid);
        ({
          uniformName: uniformNameRef,
          description: descriptionRef,
          colorHex: colorHexRef,
        })[invalid.field].current?.focus();
        return;
      }
    }
    setFieldError(undefined);
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (remove && piece) {
        if (team.token) await deleteUniform(team.token, piece.id);
        else deletePreviewUniform(piece.id);
      } else if (team.token)
        await saveUniform(team.token, team.id, body, piece?.id);
      else savePreviewUniform(body, piece?.id);
      router.dismissTo('/uniformes');
    } catch (failure) {
      if (team.token && failure instanceof ApiError && failure.status === 401)
        await invalidateSession(team.token);
      else
        setError(
          failure instanceof ApiError && failure.status === 403
            ? 'Somente o criador do time pode alterar uniformes.'
            : failure instanceof ApiError && failure.status === 404
              ? 'Peça ou time indisponível. Volte à lista para atualizar.'
              : 'Não foi possível confirmar a alteração. Confira a conexão e atualize a lista antes de tentar novamente.',
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const disabled = busy || confirming;
  return (
    <>
      <View style={styles.card}>
        <PieceCard
          piece={{
            ...input,
            id: piece?.id ?? 'new',
            colorHex: /^#[0-9a-fA-F]{6}$/.test(input.colorHex)
              ? input.colorHex
              : '#000000',
          }}
        />
      </View>
      <View style={styles.card}>
        <SelectField
          label="Tipo de peça"
          options={types}
          value={input.pieceType}
          disabled={disabled || !!piece}
          onChange={(value) => change('pieceType', value as PieceType)}
        />
        {piece && (
          <Text style={styles.text}>
            O tipo da peça é definido no cadastro.
          </Text>
        )}
        <FormField
          label="Identificação do uniforme"
          ref={uniformNameRef}
          error={
            fieldError?.field === 'uniformName' ? fieldError.message : undefined
          }
          value={input.uniformName}
          maxLength={80}
          editable={!disabled}
          onChangeText={(value) => change('uniformName', value)}
        />
        <FormField
          label="Nome da Cor"
          ref={descriptionRef}
          error={
            fieldError?.field === 'description' ? fieldError.message : undefined
          }
          value={input.description}
          maxLength={80}
          editable={!disabled}
          onChangeText={(value) => change('description', value)}
        />
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Cores sugeridas"
          style={local.colors}
        >
          {palette.map(({ color, name }) => (
            <Pressable
              key={color}
              accessibilityRole="radio"
              accessibilityLabel={name}
              aria-checked={input.colorHex.toUpperCase() === color}
              accessibilityState={{
                checked: input.colorHex.toUpperCase() === color,
                disabled,
              }}
              disabled={disabled}
              onPress={() => {
                change('colorHex', color);
                change('description', name);
                setFieldError(undefined);
              }}
              style={[
                local.swatch,
                { backgroundColor: color },
                input.colorHex.toUpperCase() === color && local.selected,
              ]}
            />
          ))}
        </View>
        <Text style={styles.text}>
          Cor selecionada ·{' '}
          {input.description ||
            palette.find(({ color }) => color === input.colorHex.toUpperCase())
              ?.name ||
            'Personalizada'}
        </Text>
        <ActionButton
          label={
            customColor ? 'Ocultar ajuste de cor' : 'Ajustar cor manualmente'
          }
          disabled={disabled}
          onPress={() => {
            if (
              customColor &&
              !/^#[0-9a-fA-F]{6}$/.test(input.colorHex.trim())
            ) {
              setFieldError({
                field: 'colorHex',
                message: 'Use o formato hexadecimal, como #1E40AF.',
              });
              colorHexRef.current?.focus();
              return;
            }
            setCustomColor(!customColor);
          }}
        />
        {customColor && (
          <FormField
            label="Cor hexadecimal"
            ref={colorHexRef}
            error={
              fieldError?.field === 'colorHex' ? fieldError.message : undefined
            }
            value={input.colorHex}
            maxLength={7}
            editable={!disabled}
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={(value) => change('colorHex', value)}
          />
        )}
      </View>
      <View style={styles.card}>
        {(['isHomeDefault', 'isAwayDefault'] as const).map((flag) => (
          <View style={local.toggle} key={flag}>
            <Text style={styles.label}>
              {flag === 'isHomeDefault'
                ? 'Padrão para casa'
                : 'Padrão para fora'}
            </Text>
            <Switch
              accessibilityLabel={
                flag === 'isHomeDefault'
                  ? 'Padrão para casa'
                  : 'Padrão para fora'
              }
              disabled={disabled}
              value={input[flag]}
              onValueChange={(value) => change(flag, value)}
              trackColor={{ true: theme.colors.accent }}
            />
          </View>
        ))}
        <Text style={styles.text}>
          Ao salvar como padrão, a peça substitui o padrão anterior do mesmo
          tipo. Jogos já salvos mantêm suas escolhas.
        </Text>
      </View>
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
      {confirming ? (
        <View style={[styles.card, styles.highlighted]}>
          <Text style={styles.label}>
            Excluir esta peça? Os jogos que a utilizam ficarão sem essa peça.
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
              onPress={() => router.dismissTo('/uniformes')}
            />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <ActionButton
            icon="save"
            label={busy ? 'Salvando…' : 'Salvar peça'}
            primary
            disabled={busy}
            onPress={() => void submit(false)}
          />
          {piece && (
            <ActionButton
              icon="remove"
              label="Excluir peça"
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
            onPress={() => router.dismissTo('/uniformes')}
          />
        </View>
      )}
    </>
  );
}

function UniformEditor({ team, id }: { team: AgendaTeam; id?: string }) {
  const router = useRouter();
  const { state, retry } = useUniforms(team);
  const data = state.status === 'ready' ? state.data : null;
  const piece = data?.uniforms.find((item) => item.id === id);
  const available = data?.team.isOwner === true && (!id || piece);
  return (
    <HomeScreen
      title={id ? 'Editar peça' : 'Nova peça'}
      description={data?.team.name}
      standalone
      onBack={() => router.dismissTo('/uniformes')}
    >
      {state.status === 'loading' && <LoadingMatches />}
      {state.status === 'error' && (
        <MatchLoadError error={state.error} retry={retry} />
      )}
      {data && !available && (
        <Text style={styles.text}>
          {data.team.isOwner
            ? 'Peça indisponível neste time.'
            : 'Somente o criador do time pode alterar uniformes.'}
        </Text>
      )}
      {available && <UniformForm key={id ?? 'new'} team={team} piece={piece} />}
    </HomeScreen>
  );
}

export function UniformsScreen() {
  const team = useAgendaTeam();
  return team ? (
    <UniformList key={team.id} team={team} />
  ) : (
    <Redirect href="/buscar" />
  );
}
export function UniformScreen() {
  const team = useAgendaTeam();
  const { id } = useLocalSearchParams<{ id?: string }>();
  return team ? (
    <UniformEditor key={`${team.id}:${id ?? 'new'}`} team={team} id={id} />
  ) : (
    <Redirect href="/buscar" />
  );
}
const local = StyleSheet.create({
  piece: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  details: { flex: 1, gap: 6 },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  defaultText: { color: theme.colors.accent, fontWeight: '700', fontSize: 14 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  selected: { borderWidth: 3, borderColor: theme.colors.accent },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
});
