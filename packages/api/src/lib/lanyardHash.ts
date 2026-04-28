import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

// Stable digest of a lanyard contact-discovery match set, used by the
// silent-push notification flow to detect "have we already seen this
// state?" without leaking the contents through the notify provider.
//
// Both ends — this client and the lanyard agent on the user's ship —
// must produce the same digest from the same logical match set, so the
// canonicalization rules below need to be mirrored exactly on the Hoon
// side. SHA-256 is `shax` in Hoon; the canonical bytes are the UTF-8
// encoding of `phone|ship` rows joined by `\n`, with rows sorted by
// phone number lexicographically. Truncate to the first 8 hex chars.

export function canonicalizeMatchSet(matches: [string, string][]): string {
  return matches
    .slice()
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([phone, ship]) => `${phone}|${ship}`)
    .join('\n');
}

export function hashMatchSet(matches: [string, string][]): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalizeMatchSet(matches)))).slice(
    0,
    8
  );
}
