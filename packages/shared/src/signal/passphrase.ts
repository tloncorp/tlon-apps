import { deriveKeys } from './crypto';
import type { PasskeyIdentity } from './types';

/**
 * Derive a 32-byte root secret from a passphrase and salt using
 * WebCrypto PBKDF2 (SHA-256, 600 000 iterations).
 *
 * Iteration count follows OWASP 2023 recommendation for PBKDF2-SHA256.
 */
async function pbkdf2DeriveRoot(
  passphrase: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    baseKey,
    256
  );
  return new Uint8Array(bits);
}

/**
 * Register a new passphrase identity.
 * Generates a random salt, derives rootSecret via PBKDF2,
 * then feeds it through the same deriveKeys hierarchy as passkeys.
 */
export async function registerWithPassphrase(
  passphrase: string
): Promise<PasskeyIdentity> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const rootSecret = await pbkdf2DeriveRoot(passphrase, salt);
  const keys = deriveKeys(rootSecret);

  return {
    credentialId: salt, // salt doubles as credentialId for storage
    rootSecret,
    ...keys,
  };
}

/**
 * Unlock an existing passphrase identity using a stored salt.
 * Re-derives the same rootSecret via PBKDF2.
 */
export async function unlockWithPassphrase(
  passphrase: string,
  salt: Uint8Array
): Promise<PasskeyIdentity> {
  const rootSecret = await pbkdf2DeriveRoot(passphrase, salt);
  const keys = deriveKeys(rootSecret);

  return {
    credentialId: salt,
    rootSecret,
    ...keys,
  };
}
