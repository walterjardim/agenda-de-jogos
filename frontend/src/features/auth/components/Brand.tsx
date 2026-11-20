import { StyleSheet, Text, View } from 'react-native';
import { CalendarIcon } from '../../../shared/components/CalendarIcon';
import { theme } from '../../../shared/theme/theme';

export function Brand() {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel="Agenda de Jogos"
    >
      <View style={styles.icon}>
        <CalendarIcon size={58} color={theme.colors.white} />
      </View>
      <View>
        <Text style={styles.title}>Agenda</Text>
        <Text style={[styles.title, styles.accent]}>de Jogos</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: {
    backgroundColor: theme.colors.accent,
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 34,
  },
  accent: { color: theme.colors.accent },
});
