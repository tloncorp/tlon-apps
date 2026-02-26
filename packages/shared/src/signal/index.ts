// Types
export type {
  Key,
  WireKey,
  Keypair,
  Ed25519Keypair,
  X25519Keypair,
  SignedPrekey,
  PasskeyIdentity,
  PrekeyBundle,
  Ratchet,
  E2ESession,
  AuthType,
  SignalBlobType,
  SignalBlob,
  SerializedKeypair,
  SerializedRatchet,
  SerializedSession,
} from './types';

export { isSignalBlob, parseSignalBlob, makeSignalBlob } from './types';

// Crypto
export {
  deriveKeys,
  deriveOtp,
  signWithIdentity,
  verifySignature,
  x25519SharedSecret,
  randomX25519Keypair,
  hmacSha256,
  encryptState,
  decryptState,
  toHex,
  toBytes,
  serializeCredentialId,
  deserializeCredentialId,
  serializeKeypair,
  deserializeKeypair,
} from './crypto';

// Ratchet
export {
  symmetricRatchet,
  initRatchetFromSession,
  dhRatchetInitiator,
  dhRatchet,
  encryptMessage,
  decryptMessage,
} from './ratchet';

// X3DH
export { initiatorX3DH, responderX3DH } from './x3dh';

// Passkey
export { isPrfSupported, register, unlock } from './passkey';

// Passphrase
export { registerWithPassphrase, unlockWithPassphrase } from './passphrase';

// Auth
export { finalizeAuth } from './auth';

// Store
export { signalStore } from './store';
