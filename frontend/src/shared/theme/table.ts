import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const tableStyles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: theme.colors.white,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  header: { backgroundColor: theme.colors.accentSurface },
  heading: { color: theme.colors.accent, fontSize: 13, fontWeight: '700' },
  record: { borderTopWidth: 1, borderTopColor: theme.colors.surfaceBorder },
  number: { width: 34, textAlign: 'center' },
  player: { flex: 1, minWidth: 0 },
  details: { gap: 4 },
  position: { color: theme.colors.muted, fontSize: 14, lineHeight: 20 },
  status: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
  unavailable: { color: theme.colors.accent },
  actions: { width: 96, flexDirection: 'row', gap: 4 },
  action: {
    width: 46,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: theme.colors.surfaceBorder,
    backgroundColor: theme.colors.white,
  },
  remove: { backgroundColor: theme.colors.accentSurface },
  dimmed: { opacity: 0.55 },
  confirmation: {
    padding: 12,
    gap: 12,
    backgroundColor: theme.colors.accentSurface,
  },
});
