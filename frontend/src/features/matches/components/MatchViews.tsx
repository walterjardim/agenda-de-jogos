import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';
import { ActionButton } from '../../../shared/components/ActionButton';
import { ApiError } from '../../auth/api';
import { theme } from '../../../shared/theme/theme';
import { surfaces } from '../../../shared/theme/surfaces';

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
        style={({ pressed }) => [
          styles.input,
          styles.trigger,
          (open || pressed) && styles.selected,
          disabled && styles.disabled,
        ]}
      >
        <Text style={styles.value}>{selected?.label ?? 'Selecione'}</Text>
        <Text aria-hidden style={styles.indicator}>
          {open ? '▴' : '▾'}
        </Text>
      </Pressable>
      {open && (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          style={[styles.card, styles.options]}
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
              style={({ pressed }) => [
                styles.option,
                (pressed || option.id === value) && styles.selected,
              ]}
            >
              <Text style={styles.value}>{option.label}</Text>
              {option.id === value && (
                <Text aria-hidden style={styles.indicator}>
                  ✓
                </Text>
              )}
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
    <View style={[styles.card, styles.highlighted]}>
      <Text accessibilityLiveRegion="polite" style={styles.text}>
        {error instanceof ApiError && error.status === 404
          ? 'Os dados do time ou o serviço solicitado estão indisponíveis.'
          : 'Não foi possível carregar os dados. Confira a conexão.'}
      </Text>
      <ActionButton icon="refresh" label="Tentar novamente" onPress={retry} />
    </View>
  );
}

export const styles = StyleSheet.create({
  ...surfaces,
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { flex: 1, color: theme.colors.text, fontSize: 16 },
  indicator: { color: theme.colors.accent, fontSize: 17, fontWeight: '800' },
  options: { padding: 4, gap: 2, borderRadius: 12 },
  option: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    borderRadius: 9,
  },
  selected: {
    backgroundColor: theme.colors.accentSurface,
    borderColor: theme.colors.accent,
  },
  disabled: { opacity: 0.65 },
});
