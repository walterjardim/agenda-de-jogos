import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../shared/theme/theme';
import { TabIcon } from './TabIcon';

export function HomeMenu({ children }: { children: ReactNode }) {
  return (
    <View style={styles.menu}>
      <Text accessibilityRole="header" style={styles.heading}>
        Atalhos do time
      </Text>
      <View style={styles.items}>{children}</View>
    </View>
  );
}

export function HomeMenuItem({
  icon,
  label,
  primary = false,
  onPress,
}: {
  icon: ComponentProps<typeof TabIcon>['name'];
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const iconColor = primary ? theme.colors.white : theme.colors.accent;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        primary && styles.primaryItem,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.itemHeader}>
        <View style={[styles.icon, primary && styles.primaryIcon]}>
          <TabIcon name={icon} color={iconColor} />
        </View>
        <TabIcon
          name="chevron"
          color={primary ? theme.colors.white : theme.colors.muted}
        />
      </View>
      <Text style={[styles.label, primary && styles.primaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menu: { gap: 8 },
  heading: { color: theme.colors.text, fontSize: 16, fontWeight: '800' },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: {
    flexBasis: '46%',
    flexGrow: 1,
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 14,
    borderColor: theme.colors.surfaceBorder,
    backgroundColor: theme.colors.white,
  },
  primaryItem: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  pressed: { opacity: 0.8 },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: theme.colors.accentSurface,
  },
  primaryIcon: { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  primaryLabel: { color: theme.colors.white },
});
