import { useEffect, useRef, useState } from 'react';
import { apiUrl, loginSetupMessage, webClientId } from '../config';
import type { GoogleLoginProps } from './GoogleLogin';
import { GoogleSignInButton } from './GoogleSignInButton';

type GoogleIdentity = {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: {
      theme: 'outline';
      size: 'large';
      text: 'signin_with';
      locale: string;
      width: number;
    },
  ) => void;
};

function identityApi() {
  return (
    window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }
  ).google?.accounts?.id;
}

let loadingScript: Promise<GoogleIdentity> | undefined;

function loadGoogle() {
  const sdk = identityApi();
  if (sdk) return Promise.resolve(sdk);

  loadingScript ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(fail, 12000);

    function fail() {
      clearTimeout(timeout);
      script.remove();
      loadingScript = undefined;
      reject(new Error('Não foi possível carregar o login do Google.'));
    }

    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      const loaded = identityApi();
      if (!loaded) return fail();
      clearTimeout(timeout);
      resolve(loaded);
    };
    document.head.append(script);
  });
  return loadingScript;
}

export function GoogleLogin({
  disabled,
  onCredential,
  onError,
}: GoogleLoginProps) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = container.current;
    if (!element || !apiUrl || !webClientId) return;
    const clientId = webClientId;
    let active = true;

    loadGoogle()
      .then((google) => {
        if (!active) return;
        google.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            if (!active) return;
            if (credential) void onCredential(credential);
            else onError('O Google não retornou o token de identidade.');
          },
        });
        google.renderButton(element, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          locale: 'pt-BR',
          width: Math.min(element.clientWidth || 250, 400),
        });
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          onError('Não foi possível carregar o login do Google.');
        }
      });

    return () => {
      active = false;
      element.replaceChildren();
    };
  }, [attempt, onCredential, onError]);

  if (!apiUrl || !webClientId) {
    return <GoogleSignInButton onPress={() => onError(loginSetupMessage)} />;
  }

  return (
    <>
      <div
        ref={container}
        inert={disabled}
        style={{ minHeight: failed ? 0 : 40 }}
      />
      {failed && (
        <GoogleSignInButton
          onPress={() => {
            setFailed(false);
            onError('');
            setAttempt((value) => value + 1);
          }}
        />
      )}
    </>
  );
}
