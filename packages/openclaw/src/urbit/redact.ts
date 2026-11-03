import { redactToolPayloadText } from 'openclaw/plugin-sdk/logging-core';

// Secrets this plugin holds (session cookie values, login codes) are masked
// by exact value first, so their representation in a body does not matter.
const MIN_SECRET_LENGTH = 8;
const MAX_KNOWN_SECRETS = 64;
const knownSecrets = new Set<string>();

export function registerSecret(value: string): void {
  if (value.length < MIN_SECRET_LENGTH) {
    return;
  }
  knownSecrets.delete(value);
  knownSecrets.add(value);
  if (knownSecrets.size > MAX_KNOWN_SECRETS) {
    const oldest = knownSecrets.values().next().value;
    if (oldest !== undefined) {
      knownSecrets.delete(oldest);
    }
  }
}

export function clearKnownSecrets(): void {
  knownSecrets.clear();
}

/** The value of a `name=value; attrs` cookie string, if any. */
function urbitCookieValue(cookie: string): string | undefined {
  const pair = cookie.split(';')[0] ?? '';
  const eq = pair.indexOf('=');
  if (eq < 0) {
    return undefined;
  }
  return pair
    .slice(eq + 1)
    .trim()
    .replace(/^"(.*)"$/, '$1');
}

/** Registers the value of a `name=value; attrs` cookie string. */
export function registerUrbitCookie(cookie: string): void {
  const value = urbitCookieValue(cookie);
  if (value !== undefined) {
    registerSecret(value);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactKnownSecrets(text: string): string {
  if (knownSecrets.size === 0) {
    return text;
  }
  const pattern = [...knownSecrets]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  return text.replace(new RegExp(pattern, 'g'), '***');
}

const COOKIE_NAME = String.raw`urbauth-[a-z0-9~-]+`;

// `"urbauth-~zod": "value"` (either quote style); keeps the JSON shape.
const COOKIE_JSON_KEY_RE = new RegExp(
  String.raw`(["'])(${COOKIE_NAME})\1(\s*:\s*)(["'])(?:\\.|(?!\4)[^\\])*\4`,
  'gi'
);

// `urbauth-~zod=value`, `="value"`, `='value'`, or `=\"value\"` inside JSON.
const COOKIE_PAIR_RE = new RegExp(
  String.raw`\b(${COOKIE_NAME})=(?:\\?"[^"\\]*\\?"|'[^']*'|[^\s"'(),;\\]+)`,
  'gi'
);

// A header value runs to a line break (raw or JSON-escaped) or the end of the
// enclosing JSON string; quoted pair values may contain quotes.
const HEADER_VALUE = String.raw`(?:=\\?"[^"\\\r\n]*\\?"|='[^'\r\n]*'|\\(?![nr"])|[^\r\n"'\\])*`;

// `Set-Cookie:` is never diagnostic prose, so it matches anywhere, including
// as a JSON key.
const SET_COOKIE_HEADER_RE = new RegExp(
  String.raw`(set-cookie["']?\s*:\s*["']?)${HEADER_VALUE}`,
  'gi'
);

// A bare `Cookie:` only at the start of a line or of a JSON string.
const COOKIE_HEADER_RE = new RegExp(
  String.raw`(^|[\r\n{"]|\\[nr])(\s*cookie\s*:\s*)${HEADER_VALUE}`,
  'gi'
);

export type UrbitErrorRedactionOptions = {
  /** The cookie sent with the failed request; masked regardless of the registry. */
  cookie?: string;
};

export function redactUrbitErrorText(
  text: string,
  options: UrbitErrorRedactionOptions = {}
): string {
  const requestSecret = options.cookie
    ? urbitCookieValue(options.cookie)
    : undefined;
  const withoutRequestSecret =
    requestSecret && requestSecret.length >= MIN_SECRET_LENGTH
      ? text.split(requestSecret).join('***')
      : text;
  // Ours run first so the shared redactor cannot rewrite a cookie name
  // before these masks see it.
  const masked = redactKnownSecrets(withoutRequestSecret)
    .replace(COOKIE_JSON_KEY_RE, '$1$2$1$3$4***$4')
    .replace(COOKIE_PAIR_RE, '$1=***')
    .replace(SET_COOKIE_HEADER_RE, '$1***')
    .replace(COOKIE_HEADER_RE, '$1$2***');
  return redactToolPayloadText(masked);
}
