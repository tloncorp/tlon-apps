// src/redact.ts
// Best-effort secret scrubbing applied to every string before upload. Documented in README.
const RULES: [RegExp, string][] = [
  // Urbit +code: four 6-letter syllable groups. Require all lowercase and 4 groups to avoid hyphenated prose.
  [/\b[a-z]{6}-[a-z]{6}-[a-z]{6}-[a-z]{6}\b/g, '[redacted:urbit-code]'],
  [/urbauth-~[a-z-]+=[^;\s]+/g, '[redacted:urbauth-cookie]'],
  [/(X-Api-Key:\s*)\S+/gi, '$1[redacted:api-key]'],
  [/(Bearer\s+)[A-Za-z0-9._\-]+/g, '$1[redacted:bearer]'],
  [/\bsk-[A-Za-z0-9_\-]{20,}/g, '[redacted:provider-key]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[redacted:aws-key]'],
  [/\bghp_[A-Za-z0-9]{20,}/g, '[redacted:github-token]'],
  [/\bxox[abp]-[A-Za-z0-9\-]+/g, '[redacted:slack-token]'],
  [/(password=)[^&\s]+/gi, '$1[redacted:password]'],
];

export function redact(s: string): string {
  let out = s;
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  return out;
}
