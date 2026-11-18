import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';
import { ActionButton } from '../../home/components/HomeScreen';
import { ApiError } from '../../auth/api';
import { theme } from '../../../shared/theme/theme';

type Option = { id: string | null; label: string };

export function SelectField({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.id === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? 'Selecione'}`}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen(!open)}
        style={styles.input}
      >
        <Text style={styles.text}>
          {selected?.label ?? 'Selecione'} {open ? '▴' : '▾'}
        </Text>
      </Pressable>
      {open && (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          style={styles.card}
        >
          {options.map((option) => (
            <Pressable
              key={option.id ?? 'none'}
              accessibilityRole="radio"
              accessibilityState={{ checked: option.id === value, disabled }}
              disabled={disabled}
              onPress={() => {
                onChange(option.id);
                setOpen(false);
              }}
              style={styles.option}
            >
              <Text style={styles.text}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function LoadingMatches() {
  return (
    <ActivityIndicator
      accessibilityLabel="Carregando"
      color={theme.colors.primary}
    />
  );
}

export function MatchLoadError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text accessibilityLiveRegion="polite" style={styles.text}>
        {error instanceof ApiError && error.status === 404
          ? 'Os dados do time ou o serviço solicitado estão indisponíveis.'
          : 'Não foi possível carregar os dados. Confira a conexão.'}
      </Text>
      <ActionButton label="Tentar novamente" onPress={retry} />
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: theme.colors.white,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  field: { gap: 6 },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  label: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  text: { color: theme.colors.muted, fontSize: 16, lineHeight: 23 },
  input: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.white,
    color: theme.colors.text,
    fontSize: 16,
  },
  option: { minHeight: 44, justifyContent: 'center' },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  error: { color: theme.colors.primary, fontSize: 15, fontWeight: '700' },
});
