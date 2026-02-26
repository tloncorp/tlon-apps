import { deriveKeys } from './crypto';
import type { PasskeyIdentity } from './types';

// The salt used for PRF evaluation — must be stable across sessions.
const PRF_SALT = new TextEncoder().encode('urbit-signal-passkey-v1');

export async function isPrfSupported(): Promise<boolean> {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';
}

export async function register(username: string): Promise<PasskeyIdentity> {
  const userId = new TextEncoder().encode(username);
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: {
        name: 'Tlon',
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      challenge,
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      extensions: {
        // @ts-expect-error PRF extension not in standard TS types yet
        prf: {},
      },
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Passkey registration cancelled');
  }

  const createResponse = credential.getClientExtensionResults() as {
    prf?: { enabled?: boolean };
  };
  if (!createResponse.prf?.enabled) {
    throw new Error(
      'PRF extension not supported by this authenticator. ' +
        'Try using a different browser or platform authenticator.'
    );
  }

  const credentialId = new Uint8Array(credential.rawId);
  const rootSecret = await evaluatePrf(credentialId);
  const keys = deriveKeys(rootSecret);

  return { credentialId, rootSecret, ...keys };
}

export async function unlock(
  credentialId: Uint8Array
): Promise<PasskeyIdentity> {
  const rootSecret = await evaluatePrf(credentialId);
  const keys = deriveKeys(rootSecret);
  return { credentialId, rootSecret, ...keys };
}

async function evaluatePrf(credentialId: Uint8Array): Promise<Uint8Array> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: credentialId, type: 'public-key' }],
      userVerification: 'required',
      extensions: {
        // @ts-expect-error PRF extension not in standard TS types yet
        prf: {
          eval: {
            first: PRF_SALT,
          },
        },
      },
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error('Passkey authentication cancelled');
  }

  const results = assertion.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer } };
  };

  if (!results.prf?.results?.first) {
    throw new Error('PRF evaluation failed — no output returned');
  }

  return new Uint8Array(results.prf.results.first);
}
