import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';
import { concatBytes } from '@noble/hashes/utils';
import { x25519 } from '@noble/curves/ed25519';
import { ed25519 } from '@noble/curves/ed25519';
import type {
  Ed25519Keypair,
  X25519Keypair,
  PasskeyIdentity,
  Key,
} from './types';

// --- Key derivation ---

export function deriveKeys(
  rootSecret: Uint8Array
): Omit<PasskeyIdentity, 'credentialId' | 'rootSecret'> {
  // Identity keypair — Ed25519 for signing
  const identitySeed = hkdf(sha256, rootSecret, '', 'identity-signing-v1', 32);
  const identityPublic = ed25519.getPublicKey(identitySeed);

  // Identity DH keypair — X25519 for ECDH in X3DH
  const identityDHSeed = hkdf(sha256, rootSecret, '', 'identity-ecdh-v1', 32);
  const identityDHPublic = x25519.getPublicKey(identityDHSeed);

  // Prekey keypair — X25519 for ECDH in X3DH
  const prekeySeed = hkdf(sha256, rootSecret, '', 'prekey-v1', 32);
  const prekeyPublic = x25519.getPublicKey(prekeySeed);

  // Storage key — AES-256 for encrypting ratchet state stored on ship
  const storageKey = hkdf(sha256, rootSecret, '', 'storage-v1', 32);

  // OTP seed — for deterministic one-time prekey generation
  const otpSeed = hkdf(sha256, rootSecret, '', 'otp-seed-v1', 32);

  return {
    identity: { public: identityPublic, private: identitySeed },
    identityDH: { public: identityDHPublic, private: identityDHSeed },
    prekey: { public: prekeyPublic, private: prekeySeed },
    storageKey,
    otpSeed,
  };
}

// Generate a deterministic OTP keypair from seed + counter
export function deriveOtp(
  otpSeed: Uint8Array,
  counter: number
): X25519Keypair {
  const counterBytes = new Uint8Array(4);
  new DataView(counterBytes.buffer).setUint32(0, counter, false);
  const otpPrivate = hkdf(sha256, otpSeed, counterBytes, 'otp-v1', 32);
  const otpPublic = x25519.getPublicKey(otpPrivate);
  return { public: otpPublic, private: otpPrivate };
}

// --- Signature operations ---

export function signWithIdentity(
  identity: Ed25519Keypair,
  data: Uint8Array
): Uint8Array {
  return ed25519.sign(data, identity.private);
}

export function verifySignature(
  publicKey: Uint8Array,
  data: Uint8Array,
  signature: Uint8Array
): boolean {
  return ed25519.verify(signature, data, publicKey);
}

// --- ECDH ---

export function x25519SharedSecret(
  privateKey: Uint8Array,
  publicKey: Uint8Array
): Uint8Array {
  return x25519.getSharedSecret(privateKey, publicKey);
}

export function randomX25519Keypair(): X25519Keypair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { public: publicKey, private: privateKey };
}

// --- HMAC ---

export function hmacSha256(key: Key, ...msgs: Key[]): Key {
  return hmac(sha256, key, concatBytes(...msgs));
}

// --- AES-256-GCM state encryption ---

export async function encryptState(
  storageKey: Uint8Array,
  plaintext: Uint8Array
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    'raw',
    storageKey,
    'AES-GCM',
    false,
    ['encrypt']
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  );
  const result = new Uint8Array(iv.length + ciphertext.length);
  result.set(iv);
  result.set(ciphertext, iv.length);
  return result;
}

export async function decryptState(
  storageKey: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  const key = await crypto.subtle.importKey(
    'raw',
    storageKey,
    'AES-GCM',
    false,
    ['decrypt']
  );
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  );
}

// --- Hex encoding ---

export function toHex(byteArray: Uint8Array | string): string {
  if (typeof byteArray === 'string') return byteArray;
  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function toBytes(hexString: string | Uint8Array): Uint8Array {
  if (typeof hexString !== 'string') return hexString;
  let str = hexString.replace(/^0x/, '').replace(/\./g, '');
  if (str.length % 2 !== 0) str = '0' + str;
  const bytes = new Uint8Array(str.length / 2);
  for (let i = 0; i < str.length; i += 2) {
    bytes[i / 2] = parseInt(str.substring(i, i + 2), 16);
  }
  return bytes;
}

export function serializeCredentialId(credentialId: Uint8Array): string {
  return toHex(credentialId);
}

export function deserializeCredentialId(hex: string): Uint8Array {
  return toBytes(hex);
}

// --- Serialization helpers for ratchet state ---

export function serializeKeypair(keypair: {
  public: Key;
  private: Key;
}): { public: string; private: string } {
  return {
    public: toHex(keypair.public),
    private: toHex(keypair.private),
  };
}

export function deserializeKeypair(keypair: {
  public: string;
  private: string;
}): { public: Uint8Array; private: Uint8Array } {
  return {
    public: toBytes(keypair.public),
    private: toBytes(keypair.private),
  };
}
