import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../shared/components/ActionButton';
import { surfaces } from '../../../shared/theme/surfaces';
import { theme } from '../../../shared/theme/theme';
import { Brand } from '../components/Brand';

export function SessionStatusScreen({ retry }: { retry?: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={[surfaces.card, styles.card]}>
        <Brand />
        {retry ? (
          <>
            <Text style={styles.text}>
              Não foi possível verificar a sessão. Confira a conexão com a API.
            </Text>
            <ActionButton
              label="Tentar novamente"
              onPress={retry}
              primary
              fullWidth
            />
          </>
        ) : (
          <>
            <ActivityIndicator color={theme.colors.accent} />
            <Text accessibilityLiveRegion="polite" style={styles.text}>
              Verificando sua sessão…
            </Text>
          </>
        )}
      </View>
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
  card: { width: '100%', maxWidth: 400, alignItems: 'center', padding: 20 },
});
