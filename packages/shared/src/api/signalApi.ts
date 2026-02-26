import { createDevLogger } from '../debug';
import type { PrekeyBundle } from '../signal/types';
import { toHex, toBytes } from '../signal/crypto';
import { getCurrentUserId, poke, scry, subscribeOnce } from './urbit';

const logger = createDevLogger('signalApi', false);

// --- Credential ID ---

export async function saveCredentialId(
  credentialId: Uint8Array
): Promise<void> {
  const hex = toHex(credentialId);
  await poke({
    app: 'signal',
    mark: 'signal-action',
    json: {
      ship: getCurrentUserId(),
      action: { 'save-credential': hex },
    },
  });
}

export async function loadCredentialId(): Promise<Uint8Array | null> {
  try {
    const hex = await scry<string>({
      app: 'signal',
      path: '/v0/credential',
    });
    if (!hex) return null;
    return toBytes(hex);
  } catch {
    return null;
  }
}

// --- Auth type ---

export async function saveAuthType(
  authType: 'passkey' | 'passphrase'
): Promise<void> {
  await poke({
    app: 'signal',
    mark: 'signal-action',
    json: {
      ship: getCurrentUserId(),
      action: { 'save-auth-type': authType },
    },
  });
}

export async function loadAuthType(): Promise<
  'passkey' | 'passphrase' | null
> {
  try {
    const type = await scry<string>({
      app: 'signal',
      path: '/v0/auth-type',
    });
    if (type === 'passkey' || type === 'passphrase') return type;
    return null;
  } catch {
    return null;
  }
}

// --- Prekey bundle ---

export async function publishPrekeyBundle(
  identityPub: Uint8Array,
  identityDHPub: Uint8Array,
  spkKey: Uint8Array,
  spkSig: Uint8Array
): Promise<void> {
  await poke({
    app: 'signal',
    mark: 'signal-action',
    json: {
      ship: getCurrentUserId(),
      action: {
        'publish-prekeys': {
          'identity-pub': toHex(identityPub),
          'identity-dh-pub': toHex(identityDHPub),
          'spk-key': toHex(spkKey),
          'spk-sig': toHex(spkSig),
        },
      },
    },
  });
}

/**
 * Fetch a peer's prekey bundle by subscribing to our own %signal agent
 * at /v0/prekeys/{ship}, which proxies to the peer's agent.
 * Returns null if the peer doesn't have %signal installed or has no bundle.
 */
export async function fetchPeerPrekeyBundle(
  ship: string
): Promise<PrekeyBundle | null> {
  try {
    // Our agent watches the peer's /v0/prekeys, gets a fact, and forwards it
    const bundle = await subscribeOnce<{
      'identity-pub': string;
      'identity-dh-pub': string;
      'spk-key': string;
      'spk-sig': string;
    }>(
      { app: 'signal', path: `/v0/prekeys/${ship}` },
      15_000 // 15s timeout
    );

    if (
      !bundle ||
      !bundle['identity-pub'] ||
      !bundle['identity-dh-pub'] ||
      !bundle['spk-key'] ||
      !bundle['spk-sig']
    ) {
      return null;
    }

    return {
      identityPub: toBytes(bundle['identity-pub']),
      identityDHPub: toBytes(bundle['identity-dh-pub']),
      spkKey: toBytes(bundle['spk-key']),
      spkSig: toBytes(bundle['spk-sig']),
    };
  } catch (e) {
    logger.log('fetchPeerPrekeyBundle failed', ship, e);
    return null;
  }
}

// --- Encrypted state backup ---

export async function saveEncryptedState(
  peer: string,
  data: string
): Promise<void> {
  await poke({
    app: 'signal',
    mark: 'signal-action',
    json: {
      ship: getCurrentUserId(),
      action: {
        'save-state': {
          peer,
          data,
        },
      },
    },
  });
}

export async function loadEncryptedState(
  peer: string
): Promise<string | null> {
  try {
    const hex = await scry<string>({
      app: 'signal',
      path: `/v0/state/${peer}`,
    });
    if (!hex) return null;
    return hex;
  } catch {
    return null;
  }
}

export async function getStatePeers(): Promise<string[]> {
  try {
    const peers = await scry<string[]>({
      app: 'signal',
      path: '/v0/state-peers',
    });
    return peers || [];
  } catch {
    return [];
  }
}

// --- Decrypted message cache ---

export async function saveMessageCache(
  peer: string,
  data: string
): Promise<void> {
  await poke({
    app: 'signal',
    mark: 'signal-action',
    json: {
      ship: getCurrentUserId(),
      action: {
        'save-cache': {
          peer,
          data,
        },
      },
    },
  });
}

export async function loadMessageCache(
  peer: string
): Promise<string | null> {
  try {
    const hex = await scry<string>({
      app: 'signal',
      path: `/v0/cache/${peer}`,
    });
    if (!hex) return null;
    return hex;
  } catch {
    return null;
  }
}

export async function getCachePeers(): Promise<string[]> {
  try {
    const peers = await scry<string[]>({
      app: 'signal',
      path: '/v0/cache-peers',
    });
    return peers || [];
  } catch {
    return [];
  }
}
