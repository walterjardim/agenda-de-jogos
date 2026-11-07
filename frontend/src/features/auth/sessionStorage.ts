import * as SecureStore from 'expo-secure-store';

const key = 'agenda-de-jogos.session';
const options = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const sessionStorage = {
  read: () => SecureStore.getItemAsync(key, options),
  write: (value: string) => SecureStore.setItemAsync(key, value, options),
  clear: () => SecureStore.deleteItemAsync(key, options),
};
