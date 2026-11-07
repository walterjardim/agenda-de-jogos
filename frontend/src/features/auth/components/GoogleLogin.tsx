import { useRef, useState } from 'react';
import { requestGoogleIdToken } from '../googleSession';
import { GoogleSignInButton } from './GoogleSignInButton';

export type GoogleLoginProps = {
  disabled: boolean;
  onCredential: (idToken: string) => Promise<void>;
  onError: (message: string) => void;
};

export function GoogleLogin({
  disabled,
  onCredential,
  onError,
}: GoogleLoginProps) {
  const pending = useRef(false);
  const [requesting, setRequesting] = useState(false);

  async function handlePress() {
    if (pending.current) return;
    pending.current = true;
    setRequesting(true);
    onError('');

    try {
      const token = await requestGoogleIdToken();
      if (token) await onCredential(token);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Não foi possível entrar com Google.',
      );
    } finally {
      pending.current = false;
      setRequesting(false);
    }
  }

  return (
    <GoogleSignInButton
      disabled={disabled || requesting}
      onPress={handlePress}
    />
  );
}
