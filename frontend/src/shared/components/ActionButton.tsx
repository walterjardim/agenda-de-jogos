import { Pressable, StyleSheet, Text } from 'react-native';
import { Icon, type IconName } from './Icon';
import { theme } from '../theme/theme';

export function ActionButton({
  label,
  icon,
  onPress,
  primary = false,
  disabled = false,
  destructive = false,
  fullWidth = false,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        fullWidth && styles.fullWidth,
        destructive && styles.destructive,
        primary && styles.primary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          color={primary ? theme.colors.white : theme.colors.accent}
        />
      )}
      <Text style={[styles.label, primary && styles.primaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 48,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: theme.colors.surfaceBorder,
    backgroundColor: theme.colors.white,
  },
  fullWidth: { alignSelf: 'stretch' },
  destructive: { backgroundColor: theme.colors.accentSurface },
  primary: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  label: {
    flexShrink: 1,
    color: theme.colors.accent,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryLabel: { color: theme.colors.white },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
});
