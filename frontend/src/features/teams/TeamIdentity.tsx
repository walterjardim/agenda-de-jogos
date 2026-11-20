import { StyleSheet, Text, View } from 'react-native';
import { surfaces } from '../../shared/theme/surfaces';
import { theme } from '../../shared/theme/theme';

export function TeamIdentity({
  name,
  description,
  current = false,
}: {
  name: string;
  description: string;
  current?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('')
    .toLocaleUpperCase('pt-BR');

  return (
    <View style={styles.row}>
      <View aria-hidden style={styles.badge}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <View style={styles.details}>
        <Text style={surfaces.title}>{name}</Text>
        <Text style={surfaces.text}>{description}</Text>
        {current && <Text style={styles.current}>Time atual</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSurface,
  },
  initials: { color: theme.colors.accent, fontSize: 16, fontWeight: '800' },
  details: { flex: 1 },
  current: { color: theme.colors.accent, fontSize: 13, fontWeight: '700' },
});
