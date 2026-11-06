// src/redact.ts
// Best-effort secret scrubbing applied to every string before upload. Documented in README.
const RULES: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[redacted:private-key]'],
  // Urbit +code: four 6-letter syllable groups. Require all lowercase and 4 groups to avoid hyphenated prose;
  // a leading `~` marks a ship (moon) name, which is public.
  [/(?<!~)\b[a-z]{6}-[a-z]{6}-[a-z]{6}-[a-z]{6}\b/g, '[redacted:urbit-code]'],
  [/urbauth-~[a-z-]+=[^;\s]+/g, '[redacted:urbauth-cookie]'],
  [/("?x-api-key"?\s*[:=]\s*"?)\S+/gi, '$1[redacted:api-key]'],
  [/("?api[_-]?key"?\s*[:=]\s*"?)[^"\s,]+/gi, '$1[redacted:api-key]'],
  [/(Bearer\s+)\S+/g, '$1[redacted:bearer]'],
  [/(Authorization:\s*Basic\s+)\S+/gi, '$1[redacted:basic-auth]'],
  [/\bsk-[A-Za-z0-9_\-]{20,}/g, '[redacted:provider-key]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[redacted:aws-key]'],
  [/\bghp_[A-Za-z0-9]{20,}/g, '[redacted:github-token]'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, '[redacted:github-token]'],
  [/\bgh[osu]_[A-Za-z0-9]{20,}/g, '[redacted:github-token]'],
  [/\bxox[abp]-[A-Za-z0-9\-]+/g, '[redacted:slack-token]'],
  // `&` ends a URL query value; env and YAML forms run to whitespace.
  [/(password\s*[:=]\s*)[^&\s]+/gi, '$1[redacted:password]'],
];

/** `known` holds literal secrets this install holds (the Notes API key), redacted wherever they appear. */
export function redact(s: string, known: string[] = []): string {
  let out = s;
  for (const k of known) if (k) out = out.split(k).join('[redacted:known-secret]');
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  return out;
}
