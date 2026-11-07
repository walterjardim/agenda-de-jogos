import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarIcon } from '../../../shared/components/CalendarIcon';
import { theme } from '../../../shared/theme/theme';
import { Brand } from '../components/Brand';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { LoginIllustration } from '../components/LoginIllustration';

export function LoginScreen({ onOpenPreview }: { onOpenPreview?: () => void }) {
  const [configurationNotice, setConfigurationNotice] = useState(false);
  const { height } = useWindowDimensions();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.brand}>
            <Brand />
          </View>
          <View
            style={[
              styles.illustration,
              { height: Math.min(270, Math.max(170, height * 0.29)) },
            ]}
          >
            <LoginIllustration />
          </View>
          <View style={styles.introduction}>
            <Text accessibilityRole="header" style={styles.heading}>
              Seu time, organizado.
            </Text>
            <Text style={styles.description}>
              Jogos, convocações e informações prontas para compartilhar.
            </Text>
          </View>
          <View style={styles.signIn}>
            <GoogleSignInButton onPress={() => setConfigurationNotice(true)} />
            <Text style={styles.accountNote}>
              Sua conta é criada no primeiro acesso.
            </Text>
            {configurationNotice && (
              <Text accessibilityLiveRegion="polite" style={styles.notice}>
                O login com Google estará disponível após configurar a
                autenticação e conectar o backend.
              </Text>
            )}
          </View>
          {onOpenPreview && (
            <Pressable
              accessibilityRole="button"
              onPress={onOpenPreview}
              style={styles.previewButton}
            >
              <Text style={styles.previewLabel}>Prévia da home</Text>
            </Pressable>
          )}
          <View style={styles.footer}>
            <CalendarIcon size={26} />
            <Text style={styles.footerText}>Organize seus jogos</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: 460,
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
  },
  brand: { alignItems: 'center', marginBottom: 32 },
  illustration: { width: '100%', marginBottom: 24 },
  introduction: { alignItems: 'center', gap: 14 },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    color: theme.colors.text,
  },
  description: {
    fontSize: 18,
    lineHeight: 27,
    color: theme.colors.muted,
    textAlign: 'center',
    maxWidth: 360,
  },
  signIn: { marginTop: 38, gap: 14 },
  accountNote: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: theme.colors.subtle,
  },
  notice: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: theme.colors.muted,
  },
  previewButton: {
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  previewLabel: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 48,
    marginTop: 'auto',
  },
  footerText: { color: theme.colors.subtle, fontSize: 14, flexShrink: 1 },
});
