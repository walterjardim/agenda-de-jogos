import { gaxios, OAuth2Client } from 'google-auth-library';
import { ApiError } from '../http/errors.js';

export type GoogleIdentity = { sub: string; email: string; name: string };
export type VerifyGoogleIdentity = (idToken: string) => Promise<GoogleIdentity>;

export function createGoogleVerifier(
  clientIds: string[],
  client = new OAuth2Client({ transporterOptions: { timeout: 5000 } }),
): VerifyGoogleIdentity {
  return async (idToken) => {
    const invalidToken = new ApiError(401, 'UNAUTHORIZED', 'Token Google inválido');

    const ticket = await client
      .verifyIdToken({ idToken, audience: clientIds })
      .catch((error: unknown) => {
        if (error instanceof gaxios.GaxiosError) {
          throw new ApiError(
            503,
            'GOOGLE_UNAVAILABLE',
            'Validação do Google indisponível',
          );
        }
        throw invalidToken;
      });

    const payload = ticket.getPayload();
    if (
      !payload?.sub ||
      !payload.email ||
      payload.email_verified !== true ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now() / 1000
    ) {
      throw invalidToken;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name?.trim() || payload.email,
    };
  };
}
