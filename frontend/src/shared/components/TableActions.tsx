import { Pressable, View } from 'react-native';
import { tableStyles } from '../theme/table';
import { theme } from '../theme/theme';
import { Icon } from './Icon';

export function TableActions({
  itemName,
  disabled = false,
  onEdit,
  onRemove,
}: {
  itemName: string;
  disabled?: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <View role="cell" style={tableStyles.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Editar ${itemName}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onEdit}
        style={({ pressed }) => [
          tableStyles.action,
          (pressed || disabled) && tableStyles.dimmed,
        ]}
      >
        <Icon name="edit" color={theme.colors.accent} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remover ${itemName}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onRemove}
        style={({ pressed }) => [
          tableStyles.action,
          tableStyles.remove,
          (pressed || disabled) && tableStyles.dimmed,
        ]}
      >
        <Icon name="remove" color={theme.colors.accent} />
      </Pressable>
    </View>
  );
}
