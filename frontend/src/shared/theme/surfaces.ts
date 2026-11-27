import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const surfaces = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: 18,
    backgroundColor: theme.colors.white,
  },
  highlighted: {
    backgroundColor: theme.colors.accentSurface,
    borderColor: theme.colors.surfaceBorder,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.white,
    color: theme.colors.text,
    fontSize: 16,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  actions: { gap: 8 },
  field: { gap: 6 },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  label: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  text: { color: theme.colors.muted, fontSize: 16, lineHeight: 23 },
  error: { color: theme.colors.accent, fontSize: 15, fontWeight: '700' },
});
