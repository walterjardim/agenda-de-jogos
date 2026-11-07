import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { apiUrl, iosClientId, loginSetupMessage, webClientId } from './config';

export async function requestGoogleIdToken() {
  if (!apiUrl || !webClientId || (Platform.OS === 'ios' && !iosClientId)) {
    throw new Error(loginSetupMessage);
  }
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    throw new Error(
      'Use um build de desenvolvimento do app para entrar com Google.',
    );
  }

  try {
    const { GoogleSignin, isSuccessResponse } =
      await import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId, iosClientId });

    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    }
    const result = await GoogleSignin.signIn();
    if (!isSuccessResponse(result)) return null;
    if (result.data.idToken) return result.data.idToken;
  } catch {
    throw new Error(
      'Não foi possível entrar com Google. Confira a configuração do app e tente novamente.',
    );
  }

  throw new Error('O Google não retornou o token de identidade.');
}

export async function signOutGoogle() {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    return;
  const { GoogleSignin } =
    await import('@react-native-google-signin/google-signin');
  await GoogleSignin.signOut();
}
