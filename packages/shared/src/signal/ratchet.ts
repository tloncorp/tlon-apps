import { gcm } from '@noble/ciphers/aes';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import type { Key, Keypair, Ratchet } from './types';
import {
  hmacSha256,
  x25519SharedSecret,
  randomX25519Keypair,
  toHex,
  toBytes,
} from './crypto';

// --- Double Ratchet primitives ---

export function symmetricRatchet(key: Key): { msg: Key; chain: Key } {
  return {
    msg: hmacSha256(key, new Uint8Array([0x01])),
    chain: hmacSha256(key, new Uint8Array([0x02])),
  };
}

export function initRatchetFromSession(
  session: Key,
  theirs: Key,
  initiator: boolean,
  prekey: Keypair
): Ratchet {
  const { chain: chain1 } = symmetricRatchet(session);
  const { chain: chain2 } = symmetricRatchet(chain1);

  const ratchet: Ratchet = {
    current: { public: prekey.public, private: prekey.private },
    theirs,
    root: chain2,
    sendChain: initiator ? chain1 : chain2,
    receiveChain: initiator ? chain2 : chain1,
    sendCount: 0,
    receiveCount: 0,
  };

  if (initiator) {
    return dhRatchetInitiator(ratchet, theirs);
  }

  return ratchet;
}

export function dhRatchetInitiator(ratchet: Ratchet, theirs: Key): Ratchet {
  const next = randomX25519Keypair();
  const sharedSecret = x25519SharedSecret(next.private, theirs);
  const root = hmacSha256(ratchet.root, sharedSecret);
  return {
    ...ratchet,
    current: next,
    theirs,
    root,
    sendChain: root,
  };
}

export function dhRatchet(ratchet: Ratchet, theirs: Key): Ratchet {
  const sharedSecret = x25519SharedSecret(ratchet.current.private, theirs);
  const root = hmacSha256(ratchet.root, sharedSecret);

  const next = randomX25519Keypair();
  const newShared = x25519SharedSecret(next.private, theirs);
  const newSend = hmacSha256(root, newShared);

  return {
    ...ratchet,
    current: next,
    theirs,
    root: newSend,
    sendChain: newSend,
    receiveChain: root,
  };
}

// --- Higher-level encrypt/decrypt ---

export function encryptMessage(
  ratchet: Ratchet,
  plaintext: Uint8Array
): { ciphertext: Uint8Array; newRatchet: Ratchet } {
  const { msg: msgKey, chain } = symmetricRatchet(ratchet.sendChain);
  const newRatchet: Ratchet = {
    ...ratchet,
    sendChain: chain,
    sendCount: ratchet.sendCount + 1,
  };

  const derived = hkdf(
    sha256,
    msgKey,
    new Uint8Array(sha256.outputLen).fill(0),
    'send-message',
    46
  );
  const encryptionKey = derived.slice(0, 32);
  const iv = derived.slice(32);
  const ciphertext = gcm(encryptionKey, iv).encrypt(plaintext);

  return { ciphertext, newRatchet };
}

export function decryptMessage(
  ratchet: Ratchet,
  theirPublicHex: string,
  ciphertext: Uint8Array
): { plaintext: Uint8Array; newRatchet: Ratchet } {
  let r = { ...ratchet };

  // DH ratchet if sender's public key changed
  const theirsHex = toHex(r.theirs);
  if (theirPublicHex !== theirsHex) {
    r = dhRatchet(r, toBytes(theirPublicHex));
  }

  const { msg: msgKey, chain } = symmetricRatchet(r.receiveChain);
  r = {
    ...r,
    receiveChain: chain,
    receiveCount: r.receiveCount + 1,
  };

  const derived = hkdf(
    sha256,
    msgKey,
    new Uint8Array(sha256.outputLen).fill(0),
    'send-message',
    46
  );
  const encryptionKey = derived.slice(0, 32);
  const iv = derived.slice(32);
  const plaintext = gcm(encryptionKey, iv).decrypt(ciphertext);

  return { plaintext, newRatchet: r };
}
