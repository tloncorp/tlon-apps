import type { Key, X25519Keypair } from './types';
import {
  hmacSha256,
  x25519SharedSecret,
  randomX25519Keypair,
} from './crypto';

/**
 * X3DH initiator side (3-DH variant, no one-time prekey).
 * Alice (initiator) computes the shared session key using Bob's prekey bundle.
 *
 * DH operations:
 *   dh1 = IK_A x SPK_B  (identity vs signed prekey)
 *   dh2 = EK_A x IK_B   (ephemeral vs identity)
 *   dh3 = EK_A x SPK_B  (ephemeral vs signed prekey)
 */
export function initiatorX3DH(
  identityDH: X25519Keypair,
  theirSpk: Key,
  theirIdentityPub: Key
): { session: Key; ephemeral: X25519Keypair } {
  const ephemeral = randomX25519Keypair();

  const dh1 = x25519SharedSecret(identityDH.private, theirSpk);
  const dh2 = x25519SharedSecret(ephemeral.private, theirIdentityPub);
  const dh3 = x25519SharedSecret(ephemeral.private, theirSpk);

  const session = hmacSha256(ephemeral.public, dh1, dh2, dh3);

  return { session, ephemeral };
}

/**
 * X3DH responder side (3-DH variant, no one-time prekey).
 * Bob (responder) computes the shared session key using Alice's initiation.
 *
 * DH operations (complementary to initiator):
 *   dh1 = SPK_B x IK_A   (signed prekey vs identity)
 *   dh2 = IK_B x EK_A    (identity vs ephemeral)
 *   dh3 = SPK_B x EK_A   (signed prekey vs ephemeral)
 */
export function responderX3DH(
  prekey: X25519Keypair,
  identityDH: X25519Keypair,
  theirIdentityPub: Key,
  ephemeral: Key
): Key {
  const dh1 = x25519SharedSecret(prekey.private, theirIdentityPub);
  const dh2 = x25519SharedSecret(identityDH.private, ephemeral);
  const dh3 = x25519SharedSecret(prekey.private, ephemeral);

  return hmacSha256(ephemeral, dh1, dh2, dh3);
}
