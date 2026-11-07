const clientIdPattern = /^[a-z0-9-]+\.apps\.googleusercontent\.com$/i;

function googleClientId(value?: string) {
  const id = value?.trim();
  return id && clientIdPattern.test(id) ? id : undefined;
}

function apiBaseUrl(value?: string) {
  try {
    const url = new URL(value?.trim() ?? '');
    if (
      (url.protocol === 'https:' || (__DEV__ && url.protocol === 'http:')) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    ) {
      return url.href.replace(/\/+$/, '');
    }
  } catch {
    return undefined;
  }
}

export const apiUrl = apiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
export const webClientId = googleClientId(
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
);
export const iosClientId = googleClientId(
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
);
export const loginSetupMessage =
  'O login com Google precisa da configuração da API e dos clientes OAuth.';
