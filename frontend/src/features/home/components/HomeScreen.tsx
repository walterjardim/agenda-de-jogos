import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../../shared/theme/theme';
import { useAuth } from '../../auth/AuthContext';

export function HomeScreen({
  title,
  description,
  standalone = false,
  children,
}: {
  title: string;
  description?: string;
  standalone?: boolean;
  children?: ReactNode;
}) {
  const { session } = useAuth();

  return (
    <SafeAreaView
      edges={
        standalone
          ? ['top', 'left', 'right', 'bottom']
          : ['top', 'left', 'right']
      }
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.eyebrow}>
            {session ? 'Agenda de Jogos' : 'Agenda de Jogos · Prévia'}
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {description && <Text style={styles.description}>{description}</Text>}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function ActionButton({
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primaryButton,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonLabel, primary && styles.primaryButtonLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: 460,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 16,
  },
  eyebrow: { color: theme.colors.primary, fontSize: 14, fontWeight: '700' },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800' },
  description: { color: theme.colors.muted, fontSize: 16, lineHeight: 23 },
  button: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  buttonLabel: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  primaryButtonLabel: { color: theme.colors.white },
  pressed: { opacity: 0.8 },
});
