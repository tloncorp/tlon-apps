import { sendPost } from '../api/postsApi';
import * as signalApi from '../api/signalApi';
import { getCurrentUserId, subscribe as subscribeUrbit } from '../api/urbit';
import { createDevLogger } from '../debug';
import {
  signalStore,
  finalizeAuth,
  verifySignature,
  toHex,
  toBytes,
  encryptState,
  decryptState,
  encryptMessage,
  decryptMessage,
  initRatchetFromSession,
  isSignalBlob,
  parseSignalBlob,
  makeSignalBlob,
} from '../signal';
import { initiatorX3DH, responderX3DH } from '../signal/x3dh';
import { register as passkeyRegister, unlock as passkeyUnlock } from '../signal/passkey';
import { registerWithPassphrase, unlockWithPassphrase } from '../signal/passphrase';
import type { E2ESession } from '../signal/types';

const logger = createDevLogger('signalActions', false);

// --- Auth ---

export async function setupPasskeyAuth(): Promise<void> {
  const userId = getCurrentUserId();
  // Notify peers to discard their sessions before we rekey
  await broadcastRekey();
  const passkey = await passkeyRegister(userId);
  signalStore.clearAllSessions();
  finalizeAuth(passkey, 'passkey');

  const spk = signalStore.getSpk();
  await signalApi.saveCredentialId(passkey.credentialId);
  await signalApi.saveAuthType('passkey');
  await signalApi.publishPrekeyBundle(
    signalStore.getIdentity().public,
    signalStore.getIdentityDH().public,
    spk.key,
    spk.signature
  );
}

export async function setupPassphraseAuth(
  passphrase: string
): Promise<void> {
  // Notify peers to discard their sessions before we rekey
  await broadcastRekey();
  const passkey = await registerWithPassphrase(passphrase);
  signalStore.clearAllSessions();
  finalizeAuth(passkey, 'passphrase');

  const spk = signalStore.getSpk();
  await signalApi.saveCredentialId(passkey.credentialId);
  await signalApi.saveAuthType('passphrase');
  await signalApi.publishPrekeyBundle(
    signalStore.getIdentity().public,
    signalStore.getIdentityDH().public,
    spk.key,
    spk.signature
  );
}

export async function unlockSignal(
  passphrase?: string
): Promise<boolean> {
  try {
    const credentialIdBytes = await signalApi.loadCredentialId();
    if (!credentialIdBytes) return false;

    const authType = await signalApi.loadAuthType();
    if (!authType) return false;

    let passkey;
    if (authType === 'passkey') {
      passkey = await passkeyUnlock(credentialIdBytes);
    } else if (authType === 'passphrase') {
      if (!passphrase) return false;
      passkey = await unlockWithPassphrase(passphrase, credentialIdBytes);
    } else {
      return false;
    }

    finalizeAuth(passkey, authType);

    // Restore ratchet states from encrypted backups
    await restoreRatchetStates();
    return true;
  } catch (e) {
    logger.log('unlockSignal failed', e);
    return false;
  }
}

export function lockSignal(): void {
  signalStore.lock();
}

export function isSignalUnlocked(): boolean {
  return signalStore.isUnlocked();
}

export function getSignalAuthType() {
  return signalStore.authType;
}

// --- Rekey ---

/**
 * Notify all peers with active sessions to discard them.
 * Called before re-registration so the peer tears down its
 * old session and accepts the upcoming fresh initiation.
 */
async function broadcastRekey(): Promise<void> {
  const sessions = signalStore.getAllSessions();
  const authorId = getCurrentUserId();
  const blob = makeSignalBlob('signal:rekey', {});
  const promises: Promise<void>[] = [];
  for (const [channelId, session] of sessions) {
    if (session.status === 'active' || session.status === 'pending') {
      promises.push(
        sendPost({
          channelId,
          authorId,
          sentAt: Date.now(),
          content: [{ inline: [{ bold: ['Encryption keys changed'] }] }],
          blob,
        }).catch((e) => logger.log('failed to send rekey', channelId, e))
      );
    }
  }
  await Promise.allSettled(promises);
}

// --- E2E Lifecycle ---

/**
 * Enable E2E encryption for a DM channel.
 * Performs X3DH key agreement and sends the initiation blob as a DM.
 * Returns true on success, false on failure.
 */
export async function enableE2E(
  channelId: string
): Promise<boolean> {
  if (!signalStore.isUnlocked()) {
    logger.log('enableE2E: signal store not unlocked');
    return false;
  }

  // Don't double-initiate if we already have a session
  const existing = signalStore.getSession(channelId);
  if (existing) {
    logger.log('enableE2E: session already exists', existing.status);
    return existing.status === 'active';
  }

  // channelId for DMs is the ship name
  const peerShip = channelId;

  // Fetch peer's prekey bundle
  const bundle = await signalApi.fetchPeerPrekeyBundle(peerShip);
  if (!bundle) {
    logger.log('enableE2E: peer has no prekey bundle', peerShip);
    return false;
  }

  // Verify SPK signature using Ed25519 identity key
  if (!verifySignature(bundle.identityPub, bundle.spkKey, bundle.spkSig)) {
    logger.log('enableE2E: SPK signature verification failed');
    return false;
  }

  // X3DH initiator (3-DH, no OTP)
  const { session, ephemeral } = initiatorX3DH(
    signalStore.getIdentityDH(),
    bundle.spkKey,
    bundle.identityDHPub
  );

  // Init ratchet - theirs = spkKey (responder's prekey.public)
  const ratchet = initRatchetFromSession(
    session,
    bundle.spkKey,
    true,
    signalStore.getPrekey()
  );

  // Store session as pending
  signalStore.setSession(channelId, {
    ratchet,
    status: 'pending',
    peerShip,
  });

  // Build and send the initiation blob as a DM
  const blob = makeSignalBlob('signal:send-initiation', {
    ephemeral: toHex(ephemeral.public),
    public: toHex(signalStore.getIdentityDH().public),
  });

  const authorId = getCurrentUserId();
  await sendPost({
    channelId,
    authorId,
    sentAt: Date.now(),
    content: [{ inline: [{ bold: ['Initiating encrypted conversation'] }] }],
    blob,
  });

  return true;
}

export function disableE2E(channelId: string): void {
  signalStore.removeSession(channelId);
}

// --- Ratchet sync ---

/**
 * Reload the ratchet state for a peer from the ship's encrypted backup
 * if the backup is more advanced than the in-memory session.
 * This keeps multiple tabs/devices in sync so the recipient sees a
 * linear ratchet progression regardless of which tab sends.
 */
async function syncRatchetState(channelId: string): Promise<void> {
  if (!signalStore.isUnlocked()) return;

  const current = signalStore.getSession(channelId);
  if (!current || current.status !== 'active') return;

  try {
    const hex = await signalApi.loadEncryptedState(current.peerShip);
    if (!hex) return;

    const encrypted = toBytes(hex);
    const plain = await decryptState(signalStore.getStorageKey(), encrypted);
    const serialized = JSON.parse(new TextDecoder().decode(plain));
    const remote = signalStore.deserializeSession(serialized);

    // Only adopt the remote state if it's more advanced
    // (higher combined send+receive count means more ratchet steps)
    const localTotal =
      current.ratchet.sendCount + current.ratchet.receiveCount;
    const remoteTotal =
      remote.ratchet.sendCount + remote.ratchet.receiveCount;
    if (remoteTotal > localTotal) {
      logger.log(
        'syncRatchetState: adopting newer remote state',
        channelId,
        { local: localTotal, remote: remoteTotal }
      );
      signalStore.setSession(channelId, remote);
    }
  } catch (e) {
    logger.log('syncRatchetState failed', channelId, e);
  }
}

// --- Encrypt / Decrypt ---

export async function encryptPostContent(
  channelId: string,
  content: unknown,
  blob?: string | null
): Promise<{ content: unknown; blob: string } | null> {
  // Sync ratchet state from ship before encrypting.
  // This ensures that if another tab/device advanced the ratchet,
  // we pick up the latest state so the recipient can decrypt.
  await syncRatchetState(channelId);

  const session = signalStore.getSession(channelId);
  if (!session || session.status !== 'active') return null;

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify({ content, blob }));

  const { ciphertext, newRatchet } = encryptMessage(
    session.ratchet,
    plaintext
  );

  // Update ratchet state
  signalStore.setSession(channelId, {
    ...session,
    ratchet: newRatchet,
  });

  const signalBlob = makeSignalBlob('signal:message', {
    public: toHex(newRatchet.current.public),
    count: String(newRatchet.sendCount),
    contents: toHex(ciphertext),
  });

  // Return placeholder content + encrypted blob
  return {
    content: [{ inline: ['Encrypted message'] }],
    blob: signalBlob,
  };
}

export function decryptPostBlob(
  channelId: string,
  blob: string
): { content: unknown; blob: string | null } | null {
  const session = signalStore.getSession(channelId);
  if (!session || session.status !== 'active') return null;

  const signalMsg = parseSignalBlob(blob);
  if (signalMsg.type !== 'signal:message') return null;

  try {
    const { plaintext, newRatchet } = decryptMessage(
      session.ratchet,
      signalMsg.payload.public,
      toBytes(signalMsg.payload.contents)
    );

    signalStore.setSession(channelId, {
      ...session,
      ratchet: newRatchet,
    });

    const decoded = JSON.parse(new TextDecoder().decode(plaintext));
    return {
      content: decoded.content,
      blob: decoded.blob ?? null,
    };
  } catch (e) {
    logger.log('decryptPostBlob failed', channelId, e);
    return null;
  }
}

// --- Signal blob processing (handshake) ---

export function processSignalBlob(
  channelId: string,
  blob: string,
  authorId: string
): 'handshake' | 'message' | null {
  if (!isSignalBlob(blob)) return null;
  if (!signalStore.isUnlocked()) {
    // Track pending initiations so we can process them after unlock
    const sig = parseSignalBlob(blob);
    if (sig.type === 'signal:send-initiation') {
      signalStore.addPendingInitiation(channelId);
    }
    return null;
  }

  const currentUserId = getCurrentUserId();
  const signalMsg = parseSignalBlob(blob);

  // Skip processing our own handshake blobs — we already handled them when sending
  if (authorId === currentUserId) {
    if (
      signalMsg.type === 'signal:send-initiation' ||
      signalMsg.type === 'signal:init-ack' ||
      signalMsg.type === 'signal:rekey'
    ) {
      return 'handshake';
    }
  }

  if (signalMsg.type === 'signal:rekey') {
    // Peer rotated their keys — discard our session so the
    // subsequent initiation can establish a fresh one.
    logger.log('processSignalBlob: peer rekeyed, discarding session', channelId);
    signalStore.removeSession(channelId);
    return 'handshake';
  }

  if (signalMsg.type === 'signal:send-initiation') {
    return handleInitiation(channelId, signalMsg.payload, authorId);
  }

  if (signalMsg.type === 'signal:init-ack') {
    return handleInitAck(channelId);
  }

  if (signalMsg.type === 'signal:message') {
    return 'message';
  }

  return null;
}

function handleInitiation(
  channelId: string,
  payload: Record<string, string>,
  authorId: string
): 'handshake' {
  const existing = signalStore.getSession(channelId);
  if (existing?.status === 'pending') {
    // Both ships initiated simultaneously — use deterministic tie-breaker.
    // The ship with the lower name wins as initiator; the other becomes
    // responder by accepting this initiation.
    const currentUserId = getCurrentUserId();
    if (currentUserId < authorId) {
      logger.log('handleInitiation: double-initiation race, we win as initiator');
      return 'handshake';
    }
    logger.log('handleInitiation: double-initiation race, accepting theirs');
  }
  // Active sessions are always replaced — the peer may have rotated keys.

  const ephemeral = toBytes(payload.ephemeral);
  const theirIdentityDHPub = toBytes(payload.public);

  // X3DH responder (3-DH, no OTP)
  const session = responderX3DH(
    signalStore.getPrekey(),
    signalStore.getIdentityDH(),
    theirIdentityDHPub,
    ephemeral
  );

  // Init ratchet — theirs = theirIdentityDHPub (initiator's X25519 identity)
  const ratchet = initRatchetFromSession(
    session,
    theirIdentityDHPub,
    false,
    signalStore.getPrekey()
  );

  signalStore.setSession(channelId, {
    ratchet,
    status: 'active',
    peerShip: authorId,
  });

  // Send init-ack back to the initiator so they transition from pending → active
  const ackBlob = makeSignalBlob('signal:init-ack', {});
  const currentUserId = getCurrentUserId();
  sendPost({
    channelId,
    authorId: currentUserId,
    sentAt: Date.now(),
    content: [{ inline: [{ bold: ['Encrypted conversation established'] }] }],
    blob: ackBlob,
  }).catch((e) => logger.log('failed to send init-ack', e));

  // Schedule state backup
  backupRatchetState(authorId).catch(() => {});

  return 'handshake';
}

function handleInitAck(channelId: string): 'handshake' {
  const session = signalStore.getSession(channelId);
  if (session) {
    signalStore.setSession(channelId, {
      ...session,
      status: 'active',
    });
    // Schedule backup
    backupRatchetState(session.peerShip).catch(() => {});
  }
  return 'handshake';
}

// --- State backup ---

export async function backupRatchetState(peerId: string): Promise<void> {
  if (!signalStore.isUnlocked()) return;

  const session = signalStore.getSession(peerId);
  if (!session) return;

  const serialized = signalStore.serializeSession(session);
  const json = JSON.stringify(serialized);
  const plainBytes = new TextEncoder().encode(json);
  const encrypted = await encryptState(
    signalStore.getStorageKey(),
    plainBytes
  );
  const hexEncrypted = toHex(encrypted);

  await signalApi.saveEncryptedState(peerId, hexEncrypted);
}

export async function restoreRatchetStates(): Promise<void> {
  if (!signalStore.isUnlocked()) return;

  try {
    const peers = await signalApi.getStatePeers();
    for (const peer of peers) {
      if (signalStore.getSession(peer)) continue; // already loaded

      const hex = await signalApi.loadEncryptedState(peer);
      if (!hex) continue;

      const encrypted = toBytes(hex);
      const plain = await decryptState(
        signalStore.getStorageKey(),
        encrypted
      );
      const json = new TextDecoder().decode(plain);
      const serialized = JSON.parse(json);
      const session = signalStore.deserializeSession(serialized);
      signalStore.setSession(peer, session);
    }
  } catch (e) {
    logger.log('restoreRatchetStates failed', e);
  }
}

// --- Decrypted message cache ---

export interface CacheEntry {
  content: unknown;
  blob: string | null;
}

interface CacheBroadcast {
  channelId: string;
  postId: string;
  entry: CacheEntry;
}

// BroadcastChannel for instant same-browser tab sync.
let cacheBroadcast: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    cacheBroadcast = new BroadcastChannel('signal-message-cache');
    cacheBroadcast.addEventListener('message', (event: MessageEvent<CacheBroadcast>) => {
      const { postId, entry } = event.data;
      resolvePendingCache(postId, entry);
    });
  }
} catch {
  // BroadcastChannel not available (e.g. SSR)
}

// Pending resolvers: postId → callback.  Resolved by either
// BroadcastChannel (same browser) or Urbit subscription (cross-device).
const pendingCacheResolvers = new Map<string, (entry: CacheEntry) => void>();

function resolvePendingCache(postId: string, entry: CacheEntry) {
  const resolver = pendingCacheResolvers.get(postId);
  if (resolver) {
    pendingCacheResolvers.delete(postId);
    resolver(entry);
  }
}

/**
 * Wait for a specific post's decrypted content to appear in the cache.
 * Resolves instantly if another tab/device writes it via BroadcastChannel
 * or the Urbit cache-updates subscription.
 */
export function waitForCachedMessage(
  postId: string,
  timeout: number = 10_000
): Promise<CacheEntry | null> {
  // Check in-memory pending writes first (same tab, not yet flushed)
  for (const entries of pendingCacheWrites.values()) {
    if (entries[postId]) {
      return Promise.resolve(entries[postId]);
    }
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingCacheResolvers.delete(postId);
      resolve(null);
    }, timeout);

    pendingCacheResolvers.set(postId, (entry) => {
      clearTimeout(timer);
      resolve(entry);
    });
  });
}

let cacheSubStarted = false;

/**
 * Subscribe to /v0/cache-updates on the signal agent.
 * When any client pokes %save-cache, the agent gives a fact with the
 * full encrypted cache blob.  We decrypt it and resolve any pending
 * waitForCachedMessage promises.
 */
export function startCacheUpdateSubscription(): void {
  if (cacheSubStarted) return;
  cacheSubStarted = true;

  console.log('[signal] startCacheUpdateSubscription: subscribing to /v0/cache-updates');
  subscribeUrbit<{ peer: string; data: string }>(
    { app: 'signal', path: '/v0/cache-updates' },
    async (event) => {
      console.log('[signal] cache-updates: received fact', event?.peer, event?.data?.slice(0, 20));
      if (!signalStore.isUnlocked()) {
        console.log('[signal] cache-updates: store locked, ignoring');
        return;
      }
      if (!event?.data) {
        console.log('[signal] cache-updates: no data in event');
        return;
      }
      try {
        const encrypted = toBytes(event.data);
        const plain = await decryptState(
          signalStore.getStorageKey(),
          encrypted
        );
        const entries = JSON.parse(
          new TextDecoder().decode(plain)
        ) as Record<string, CacheEntry>;
        const postIds = Object.keys(entries);
        console.log('[signal] cache-updates: decrypted', postIds.length, 'entries, ids:', postIds.slice(0, 3));
        for (const [postId, entry] of Object.entries(entries)) {
          resolvePendingCache(postId, entry);
        }
      } catch (e) {
        console.log('[signal] cache-updates handler failed', e);
      }
    }
  ).then(
    (subId) => console.log('[signal] cache-updates: subscription established, id:', subId),
    (err) => console.log('[signal] cache-updates: subscription FAILED', err)
  );
}

// In-memory accumulator: channelId → { postId: CacheEntry }
const pendingCacheWrites: Map<string, Record<string, CacheEntry>> = new Map();
const flushTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

const CACHE_FLUSH_DELAY = 2000; // 2s debounce per channel

export function cacheDecryptedMessage(
  channelId: string,
  postId: string,
  content: unknown,
  blob: string | null,
  immediate?: boolean
): void {
  const entry: CacheEntry = { content, blob };

  let entries = pendingCacheWrites.get(channelId);
  if (!entries) {
    entries = {};
    pendingCacheWrites.set(channelId, entries);
  }
  entries[postId] = entry;

  // Broadcast to other same-browser tabs immediately
  try {
    cacheBroadcast?.postMessage({ channelId, postId, entry } satisfies CacheBroadcast);
  } catch {
    // Broadcast failed — non-critical
  }

  if (immediate) {
    // Flush to ship right away — the ship will give a fact on
    // /v0/cache-updates which notifies all other connected clients.
    console.log('[signal] cacheDecryptedMessage: immediate flush for', postId, 'in', channelId);
    const existing = flushTimers.get(channelId);
    if (existing) clearTimeout(existing);
    flushTimers.delete(channelId);
    flushMessageCache(channelId).catch((e) => logger.log('immediate flush failed', e));
    return;
  }

  // Debounce flush to ship per channel
  const existing = flushTimers.get(channelId);
  if (existing) clearTimeout(existing);
  flushTimers.set(
    channelId,
    setTimeout(() => flushMessageCache(channelId), CACHE_FLUSH_DELAY)
  );
}

async function flushMessageCache(channelId: string): Promise<void> {
  flushTimers.delete(channelId);
  const newEntries = pendingCacheWrites.get(channelId);
  if (!newEntries || Object.keys(newEntries).length === 0) return;
  console.log('[signal] flushMessageCache:', Object.keys(newEntries).length, 'entries for', channelId);
  pendingCacheWrites.delete(channelId);

  if (!signalStore.isUnlocked()) return;

  try {
    // Load existing cache from ship, merge, re-encrypt, save
    let merged: Record<string, CacheEntry> = {};

    const hex = await signalApi.loadMessageCache(channelId);
    if (hex) {
      const encrypted = toBytes(hex);
      const plain = await decryptState(signalStore.getStorageKey(), encrypted);
      merged = JSON.parse(new TextDecoder().decode(plain));
    }

    // Merge new entries
    Object.assign(merged, newEntries);

    const plainBytes = new TextEncoder().encode(JSON.stringify(merged));
    const encrypted = await encryptState(signalStore.getStorageKey(), plainBytes);
    await signalApi.saveMessageCache(channelId, toHex(encrypted));
  } catch (e) {
    logger.log('flushMessageCache failed', channelId, e);
    // Re-queue entries that failed to flush
    const current = pendingCacheWrites.get(channelId) || {};
    pendingCacheWrites.set(channelId, { ...newEntries, ...current });
  }
}

export async function loadAndDecryptMessageCache(
  channelId: string
): Promise<Record<string, CacheEntry> | null> {
  if (!signalStore.isUnlocked()) return null;

  try {
    const hex = await signalApi.loadMessageCache(channelId);
    if (!hex) return null;
    const encrypted = toBytes(hex);
    const plain = await decryptState(signalStore.getStorageKey(), encrypted);
    return JSON.parse(new TextDecoder().decode(plain));
  } catch (e) {
    logger.log('loadAndDecryptMessageCache failed', channelId, e);
    return null;
  }
}

// --- Query helpers ---

export function isE2EActive(channelId: string): boolean {
  return signalStore.isE2EActive(channelId);
}

export function isE2EPending(channelId: string): boolean {
  const session = signalStore.getSession(channelId);
  return session?.status === 'pending';
}

export function hasPendingInitiation(channelId: string): boolean {
  return signalStore.hasPendingInitiation(channelId);
}

export function clearPendingInitiation(channelId: string): void {
  signalStore.clearPendingInitiation(channelId);
}
