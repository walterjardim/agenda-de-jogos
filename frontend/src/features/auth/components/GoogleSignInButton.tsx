import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../../../shared/theme/theme';

type Props = { onPress: () => void };

export function GoogleSignInButton({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Entrar com Google"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Svg width={26} height={26} viewBox="0 0 48 48" aria-hidden={true}>
        <Path
          fill="#4285F4"
          d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c4-3.6 6-8.9 6-15.1Z"
        />
        <Path
          fill="#34A853"
          d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4.1 1.9-6.8 1.9-5.3 0-9.8-3.6-11.4-8.3H5.7v5.3A20.4 20.4 0 0 0 24 44Z"
        />
        <Path
          fill="#FBBC05"
          d="M12.6 27.5a12.2 12.2 0 0 1 0-7V15.2H5.7a20 20 0 0 0 0 17.6Z"
        />
        <Path
          fill="#EA4335"
          d="M24 12.2c3 0 5.7 1 7.8 3l5.8-5.8A19.7 19.7 0 0 0 24 4 20.4 20.4 0 0 0 5.7 15.2l6.9 5.3C14.2 15.8 18.7 12.2 24 12.2Z"
        />
      </Svg>
      <Text style={styles.label}>Entrar com Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    minHeight: 62,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  pressed: { backgroundColor: '#F0F1F3' },
  label: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
    flexShrink: 1,
  },
});
