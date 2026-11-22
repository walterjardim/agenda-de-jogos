import { useNavigation } from 'expo-router';
import {
  type NavigationAction,
  usePreventRemove,
} from 'expo-router/react-navigation';
import { useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { surfaces } from '../theme/surfaces';
import { ActionButton } from './ActionButton';

export function useDiscardChanges(dirty: boolean, saving = false) {
  const navigation = useNavigation();
  const bypass = useRef(false);
  const [action, setAction] = useState<NavigationAction>();

  usePreventRemove(dirty || saving, ({ data }) => {
    if (bypass.current) {
      bypass.current = false;
      navigation.dispatch(data.action);
    } else if (!saving) {
      setAction(data.action);
    }
  });

  return {
    allowExit: () => {
      bypass.current = true;
    },
    confirmation: (
      <Modal
        transparent
        visible={Boolean(action)}
        onRequestClose={() => setAction(undefined)}
      >
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={[surfaces.card, styles.card]}>
            <Text accessibilityRole="header" style={surfaces.label}>
              Descartar alterações?
            </Text>
            <Text style={surfaces.text}>
              As alterações que você fez ainda não foram salvas.
            </Text>
            <ActionButton
              primary
              label="Continuar editando"
              onPress={() => setAction(undefined)}
            />
            <ActionButton
              destructive
              label="Descartar alterações"
              onPress={() => {
                setAction(undefined);
                if (action) navigation.dispatch(action);
              }}
            />
          </View>
        </View>
      </Modal>
    ),
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: { width: '100%', maxWidth: 420, gap: 12 },
});
