import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { surfaces } from '../theme/surfaces';
import { theme } from '../theme/theme';

export function FormInput({
  style,
  editable,
  onFocus,
  onBlur,
  ...props
}: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      placeholderTextColor={theme.colors.muted}
      {...props}
      editable={editable}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        surfaces.input,
        props.multiline && styles.multiline,
        style,
        focused && styles.focused,
        editable === false && styles.disabled,
      ]}
    />
  );
}

export function FormField({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={surfaces.field}>
      <Text style={surfaces.label}>{label}</Text>
      <FormInput accessibilityLabel={label} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  focused: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSurface,
  },
  disabled: { opacity: 0.65 },
});
