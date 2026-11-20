import { useCallback, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../shared/components/ActionButton';
import { surfaces } from '../../../shared/theme/surfaces';
import { theme } from '../../../shared/theme/theme';
import { Brand } from '../components/Brand';
import { GoogleLogin } from '../components/GoogleLogin';
import { LoginIllustration } from '../components/LoginIllustration';

import { useAuth } from '../AuthContext';
import { ApiError } from '../api';

export function LoginScreen({ onOpenPreview }: { onOpenPreview?: () => void }) {
  const { signIn } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const submitToken = useCallback(
    async (idToken: string) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      setError('');
      try {
        await signIn(idToken);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setError('O login foi recusado. Entre com Google novamente.');
        } else if (error instanceof ApiError && error.status === 429) {
          setError('Muitas tentativas. Aguarde um minuto e tente novamente.');
        } else {
          setError(
            'Não foi possível iniciar a sessão. Confira a conexão e tente novamente.',
          );
        }
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [signIn],
  );
  const { height } = useWindowDimensions();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={[surfaces.card, surfaces.highlighted, styles.hero]}>
            <Brand />
            <View
              style={[
                styles.illustration,
                { height: Math.min(230, Math.max(140, height * 0.26)) },
              ]}
            >
              <LoginIllustration />
            </View>
          </View>
          <View style={[surfaces.card, styles.signIn]}>
            <Text accessibilityRole="header" style={styles.heading}>
              Entrar
            </Text>
            <GoogleLogin
              disabled={busy}
              onCredential={submitToken}
              onError={setError}
            />
            <Text style={styles.accountNote}>
              Sua conta é criada no primeiro acesso.
            </Text>
            {(busy || Boolean(error)) && (
              <Text
                accessibilityLiveRegion="polite"
                style={busy ? styles.notice : surfaces.error}
              >
                {busy ? 'Entrando…' : error}
              </Text>
            )}
          </View>
          {onOpenPreview && !busy && (
            <ActionButton
              label="Prévia da home"
              onPress={onOpenPreview}
              fullWidth
            />
          )}
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
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
  },
  hero: { alignItems: 'center', gap: 12, padding: 18 },
  illustration: { width: '100%' },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: theme.colors.text,
  },
  signIn: { gap: 14 },
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
});
