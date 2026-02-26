import type {
  AuthType,
  E2ESession,
  Ed25519Keypair,
  Key,
  PasskeyIdentity,
  Ratchet,
  SerializedKeypair,
  SerializedRatchet,
  SerializedSession,
  SignedPrekey,
  X25519Keypair,
} from './types';
import {
  toHex,
  toBytes,
  serializeKeypair,
  deserializeKeypair,
} from './crypto';

/**
 * In-memory signal state singleton.
 * Private keys never touch SQLite — they stay here + encrypted ship backups.
 */
class SignalStore {
  private identity: Ed25519Keypair | null = null;
  private identityDH: X25519Keypair | null = null;
  private prekey: X25519Keypair | null = null;
  private spk: SignedPrekey | null = null;
  private storageKey: Uint8Array | null = null;
  private otpSeed: Uint8Array | null = null;
  private otpCounter: number = 0;
  private credentialId: Uint8Array | null = null;
  private _authType: AuthType | null = null;
  private sessions: Map<string, E2ESession> = new Map();
  // Channels with unprocessed initiations (received while locked)
  private pendingInitiations: Set<string> = new Set();

  // --- Lifecycle ---

  unlock(passkey: PasskeyIdentity): void {
    this.identity = passkey.identity;
    this.identityDH = passkey.identityDH;
    this.prekey = passkey.prekey;
    this.storageKey = passkey.storageKey;
    this.otpSeed = passkey.otpSeed;
    this.credentialId = passkey.credentialId;
  }

  setSpk(spk: SignedPrekey): void {
    this.spk = spk;
  }

  setAuthType(authType: AuthType): void {
    this._authType = authType;
  }

  lock(): void {
    this.identity = null;
    this.identityDH = null;
    this.prekey = null;
    this.spk = null;
    this.storageKey = null;
    this.otpSeed = null;
    this.credentialId = null;
    this.sessions.clear();
  }

  isUnlocked(): boolean {
    return this.identity !== null;
  }

  // --- Getters ---

  getIdentity(): Ed25519Keypair {
    if (!this.identity) throw new Error('Signal store is locked');
    return this.identity;
  }

  getIdentityDH(): X25519Keypair {
    if (!this.identityDH) throw new Error('Signal store is locked');
    return this.identityDH;
  }

  getPrekey(): X25519Keypair {
    if (!this.prekey) throw new Error('Signal store is locked');
    return this.prekey;
  }

  getSpk(): SignedPrekey {
    if (!this.spk) throw new Error('SPK not set');
    return this.spk;
  }

  getStorageKey(): Uint8Array {
    if (!this.storageKey) throw new Error('Signal store is locked');
    return this.storageKey;
  }

  getOtpSeed(): Uint8Array {
    if (!this.otpSeed) throw new Error('Signal store is locked');
    return this.otpSeed;
  }

  getCredentialId(): Uint8Array | null {
    return this.credentialId;
  }

  get authType(): AuthType | null {
    return this._authType;
  }

  getNextOtpCounter(): number {
    return this.otpCounter++;
  }

  // --- Session management ---

  getSession(channelId: string): E2ESession | null {
    return this.sessions.get(channelId) ?? null;
  }

  setSession(channelId: string, session: E2ESession): void {
    this.sessions.set(channelId, session);
  }

  removeSession(channelId: string): void {
    this.sessions.delete(channelId);
  }

  clearAllSessions(): void {
    this.sessions.clear();
  }

  isE2EActive(channelId: string): boolean {
    const session = this.sessions.get(channelId);
    return session?.status === 'active';
  }

  getAllSessions(): Map<string, E2ESession> {
    return this.sessions;
  }

  // --- Pending initiations (received while locked) ---

  addPendingInitiation(channelId: string): void {
    this.pendingInitiations.add(channelId);
  }

  hasPendingInitiation(channelId: string): boolean {
    return this.pendingInitiations.has(channelId);
  }

  clearPendingInitiation(channelId: string): void {
    this.pendingInitiations.delete(channelId);
  }

  getPendingInitiations(): string[] {
    return [...this.pendingInitiations];
  }

  // --- Serialization for encrypted backup ---

  serializeSession(session: E2ESession): SerializedSession {
    return {
      ratchet: {
        current: serializeKeypair(session.ratchet.current),
        theirs: toHex(session.ratchet.theirs),
        root: toHex(session.ratchet.root),
        sendChain: toHex(session.ratchet.sendChain),
        receiveChain: toHex(session.ratchet.receiveChain),
        sendCount: session.ratchet.sendCount,
        receiveCount: session.ratchet.receiveCount,
      },
      status: session.status,
      peerShip: session.peerShip,
    };
  }

  deserializeSession(serialized: SerializedSession): E2ESession {
    return {
      ratchet: {
        current: deserializeKeypair(serialized.ratchet.current),
        theirs: toBytes(serialized.ratchet.theirs),
        root: toBytes(serialized.ratchet.root),
        sendChain: toBytes(serialized.ratchet.sendChain),
        receiveChain: toBytes(serialized.ratchet.receiveChain),
        sendCount: serialized.ratchet.sendCount,
        receiveCount: serialized.ratchet.receiveCount,
      },
      status: serialized.status,
      peerShip: serialized.peerShip,
    };
  }
}

export const signalStore = new SignalStore();
