/**
 * `set_timezone`: the owner's own choice of the bot's timezone (TLON-6882).
 *
 * Hosted config (openclaw.json) is root-owned and read-only to the gateway,
 * and is rebuilt on every boot, so the tool cannot edit
 * `agents.defaults.userTimezone` itself. The hosted wrapper (tlonbot's
 * entrypoint/tlawn.py) names a pier-backed file in TLON_OWNER_TIMEZONE_FILE;
 * the tool records the choice there, and tlawn reads it into userTimezone in
 * preference to TLON_TIMEZONE, at boot and whenever it changes. A running
 * gateway does not pick up an external userTimezone edit, so tlawn then asks
 * for an in-process restart, which waits for this turn to finish. Without the
 * variable nothing would apply the file, so the tool is not offered.
 */
import { randomUUID } from 'node:crypto';
import { rename, writeFile } from 'node:fs/promises';

import { textToolResult } from './tool-result.js';

export const OWNER_TIMEZONE_FILE_ENV = 'TLON_OWNER_TIMEZONE_FILE';

export type OwnerTimezoneToolParams = { timezone: string };

export type OwnerTimezoneRecord = { timezone: string; setAt: string };

export const ownerTimezoneToolMetadata = {
  name: 'set_timezone',
  label: 'Set Timezone',
  description:
    "Set the owner's timezone, which the bot uses for its clock and for scheduling. Takes an IANA zone name such as America/Los_Angeles or Asia/Tokyo. Owner-only.",
  promptSnippet:
    "`set_timezone`: set the owner's IANA timezone when they say where they are or that your times are off",
  promptGuidelines: [
    'When the owner says where they are, that they moved or are traveling, or that your times are off, call `set_timezone` with the IANA zone for that place. Ask only if the place spans several zones.',
  ],
};

export const ownerTimezoneToolParameters = {
  type: 'object',
  properties: {
    timezone: {
      type: 'string',
      maxLength: 64,
      description:
        'IANA timezone name, for example "Asia/Tokyo" or "Europe/Berlin". Not an abbreviation (PST) or offset (+09:00).',
    },
  },
  required: ['timezone'],
  additionalProperties: false,
} as const;

// Region/City names plus UTC. Excludes abbreviations and offsets, which Intl
// may accept but which don't follow daylight saving or name a place.
const IANA_NAME = /^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+)$/;

/**
 * `input` trimmed, once it names a known IANA zone; throws otherwise. Not
 * Intl's resolved name: ICU maps some current names to legacy links
 * (Asia/Kolkata -> Asia/Calcutta).
 */
export function validTimezone(input: string): string {
  const name = input.trim();
  if (!IANA_NAME.test(name)) {
    throw new Error(
      `"${name}" is not an IANA timezone name; use one like Asia/Tokyo`
    );
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return name;
  } catch {
    throw new Error(`Unknown timezone "${name}"; use one like Asia/Tokyo`);
  }
}

/** e.g. "Saturday, October 17, 2026 at 03:00 GMT+09:00" */
function describeNow(timezone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).format(now);
}

export function createOwnerTimezoneToolExecutor(deps: {
  path: string;
  now?: () => Date;
}) {
  const { path } = deps;
  const now = deps.now ?? (() => new Date());

  return async function execute(_id: string, params: OwnerTimezoneToolParams) {
    try {
      const timezone = validTimezone(String(params?.timezone ?? ''));
      const at = now();
      const record: OwnerTimezoneRecord = {
        timezone,
        setAt: at.toISOString(),
      };
      // Write-then-rename so tlawn never reads a half-written file.
      const tmp = `${path}.${randomUUID()}.tmp`;
      await writeFile(tmp, `${JSON.stringify(record)}\n`, { mode: 0o600 });
      await rename(tmp, path);
      return textToolResult(
        `Timezone set to ${timezone}. It is now ${describeNow(timezone, at)} there. ` +
          'Your clock switches to it from the next message; for anything you schedule in this turn, use this zone and offset.',
        { timezone }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return textToolResult(`Error: ${message}`, { error: true });
    }
  };
}
