import { type Ref, useState } from 'react';
import {
  type TextInput as InputRef,
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
}: TextInputProps & { ref?: Ref<InputRef> }) {
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
  error,
  style,
  ...props
}: TextInputProps & { label: string; error?: string; ref?: Ref<InputRef> }) {
  return (
    <View style={surfaces.field}>
      <Text style={surfaces.label}>{label}</Text>
      <FormInput
        accessibilityLabel={error ? `${label}. ${error}` : label}
        {...props}
        style={[style, error && styles.invalid]}
      />
      {error && (
        <Text accessibilityLiveRegion="polite" style={surfaces.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  focused: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSurface,
  },
  invalid: { borderColor: theme.colors.accent, borderWidth: 2 },
  disabled: { opacity: 0.65 },
});
