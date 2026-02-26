import { deriveKeys } from './crypto';
import { argon2DeriveRoot, argon2GenerateSalt } from './wasm';
import type { PasskeyIdentity } from './types';

/**
 * Register a new passphrase identity.
 * Generates a random salt, derives rootSecret via Argon2id WASM,
 * then feeds it through the same deriveKeys hierarchy as passkeys.
 */
export async function registerWithPassphrase(
  passphrase: string
): Promise<PasskeyIdentity> {
  const salt = await argon2GenerateSalt();
  const rootSecret = await argon2DeriveRoot(passphrase, salt);
  const keys = deriveKeys(rootSecret);

  return {
    credentialId: salt, // salt doubles as credentialId for storage
    rootSecret,
    ...keys,
  };
}

/**
 * Unlock an existing passphrase identity using a stored salt.
 * Re-derives the same rootSecret via Argon2id WASM.
 */
export async function unlockWithPassphrase(
  passphrase: string,
  salt: Uint8Array
): Promise<PasskeyIdentity> {
  const rootSecret = await argon2DeriveRoot(passphrase, salt);
  const keys = deriveKeys(rootSecret);

  return {
    credentialId: salt,
    rootSecret,
    ...keys,
  };
}
