// Internal key type — always Uint8Array in memory
export type Key = Uint8Array;

// Wire key type — hex strings on the wire
export type WireKey = string;

export interface Keypair {
  public: Key;
  private: Key;
}

export interface Ed25519Keypair {
  public: Key;
  private: Key;
}

export interface X25519Keypair {
  public: Key;
  private: Key;
}

export interface SignedPrekey {
  key: Key;
  signature: Key;
}

export interface PasskeyIdentity {
  credentialId: Uint8Array;
  rootSecret: Uint8Array;
  identity: Ed25519Keypair;
  identityDH: X25519Keypair;
  prekey: X25519Keypair;
  storageKey: Uint8Array;
  otpSeed: Uint8Array;
}

export interface PrekeyBundle {
  identityPub: Uint8Array;     // Ed25519 public key for SPK signature verification
  identityDHPub: Uint8Array;   // X25519 public key for X3DH ECDH
  spkKey: Uint8Array;
  spkSig: Uint8Array;
}

export interface Ratchet {
  current: Keypair;
  theirs: Key;
  root: Key;
  sendChain: Key;
  receiveChain: Key;
  sendCount: number;
  receiveCount: number;
}

export interface E2ESession {
  ratchet: Ratchet;
  status: 'pending' | 'active';
  peerShip: string;
}

export type AuthType = 'passkey' | 'passphrase';

// Signal blob types for the essay blob field
export type SignalBlobType =
  | 'signal:send-initiation'
  | 'signal:init-ack'
  | 'signal:message';

export interface SignalBlob {
  type: SignalBlobType;
  version: 1;
  payload: Record<string, string>;
}

export function isSignalBlob(blob: string | null | undefined): blob is string {
  if (!blob) return false;
  try {
    const p = JSON.parse(blob);
    return p?.type?.startsWith('signal:') && p?.version === 1;
  } catch {
    return false;
  }
}

export function parseSignalBlob(blob: string): SignalBlob {
  return JSON.parse(blob) as SignalBlob;
}

export function makeSignalBlob(
  type: SignalBlobType,
  payload: Record<string, string>
): string {
  const blob: SignalBlob = { type, version: 1, payload };
  return JSON.stringify(blob);
}

// Serialized forms for encrypted state backup
export interface SerializedKeypair {
  public: string;
  private: string;
}

export interface SerializedRatchet {
  current: SerializedKeypair;
  theirs: string;
  root: string;
  sendChain: string;
  receiveChain: string;
  sendCount: number;
  receiveCount: number;
}

export interface SerializedSession {
  ratchet: SerializedRatchet;
  status: 'pending' | 'active';
  peerShip: string;
}
