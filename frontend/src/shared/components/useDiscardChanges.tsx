import { usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { surfaces } from '../theme/surfaces';
import { ActionButton } from './ActionButton';

export function useDiscardChanges(dirty: boolean, saving = false) {
  const [leaving, setLeaving] = useState(false);
  const [repeatRemoval, setRepeatRemoval] = useState<() => void>();

  const disablePrevention = usePreventRemove(
    !leaving && (dirty || saving),
    ({ repeat }) => {
      if (!saving) setRepeatRemoval(() => repeat);
    },
  );

  return {
    allowExit: () => {
      setLeaving(true);
      disablePrevention();
    },
    confirmation: (
      <Modal
        transparent
        visible={Boolean(repeatRemoval)}
        onRequestClose={() => setRepeatRemoval(undefined)}
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
              onPress={() => setRepeatRemoval(undefined)}
            />
            <ActionButton
              destructive
              label="Descartar alterações"
              onPress={() => {
                setRepeatRemoval(undefined);
                setLeaving(true);
                repeatRemoval?.();
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
