import type { ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const plugins = [...(config.plugins ?? [])];

  if (
    iosClientId &&
    /^[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(iosClientId)
  ) {
    plugins.push([
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: iosClientId.split('.').reverse().join('.') },
    ]);
  }

  return { ...config, plugins };
};
