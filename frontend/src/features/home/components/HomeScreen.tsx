import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../shared/components/ActionButton';
import { CalendarIcon } from '../../../shared/components/CalendarIcon';
import { surfaces } from '../../../shared/theme/surfaces';
import { theme } from '../../../shared/theme/theme';
import { useAuth } from '../../auth/AuthContext';

export function HomeScreen({
  title,
  description,
  standalone = false,
  onBack,
  backDisabled = false,
  children,
}: {
  title: string;
  description?: string;
  standalone?: boolean;
  onBack?: () => void;
  backDisabled?: boolean;
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
          <View style={[surfaces.card, styles.header]}>
            <View style={styles.brand}>
              <View style={styles.icon}>
                <CalendarIcon size={20} color={theme.colors.white} />
              </View>
              <Text style={styles.eyebrow}>
                {session ? 'Agenda de Jogos' : 'Agenda de Jogos · Prévia'}
              </Text>
            </View>
            {onBack && (
              <ActionButton
                icon="back"
                label="Voltar"
                onPress={onBack}
                disabled={backDisabled}
              />
            )}
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            {description && <Text style={surfaces.text}>{description}</Text>}
          </View>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: 540,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  header: {
    gap: 8,
    padding: 18,
    borderTopWidth: 3,
    borderTopColor: theme.colors.accent,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: theme.colors.accent,
  },
  eyebrow: {
    flex: 1,
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: '800' },
});
