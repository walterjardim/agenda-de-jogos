import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../../shared/theme/theme';

export function SessionStatusScreen({ retry }: { retry?: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      {retry ? (
        <>
          <Text style={styles.text}>
            Não foi possível verificar a sessão. Confira a conexão com a API.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={styles.button}
          >
            <Text style={styles.label}>Tentar novamente</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.text}>Verificando sua sessão…</Text>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 24,
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  text: { color: theme.colors.text, fontSize: 16, textAlign: 'center' },
  button: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  label: { color: theme.colors.primary, fontSize: 16, fontWeight: '700' },
});
