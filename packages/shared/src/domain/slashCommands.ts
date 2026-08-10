export type BotAgentType = 'openclaw';

export interface SlashCommandOption {
  command: `/${string}`;
  title: string;
  subtitle?: string;
  // Icon NAME string, not an IconType: the shared layer must not depend on
  // @tloncorp/ui, and future hosting-served manifests carry icons as strings.
  // The popup maps the string to an IconType with a 'Command' fallback.
  icon?: string;
  keywords?: string[];
  // Static tiebreaker only; ranking is otherwise driven by the query match.
  priority: number;
  // Defaults to `${command} ` when omitted.
  insertText?: string;
}

export interface SlashCommandManifest {
  // Only the static fallback manifests carry an agent; manifests advertised
  // by bots through their contact profile omit it.
  agent?: BotAgentType;
  commands: SlashCommandOption[];
}

// ── Advertised command manifests ────────────────────────────────────────────
// Bots publish their slash-command manifest in their own contact profile,
// under BOT_COMMANDS_CONTACT_KEY, as a %text value whose text is JSON:
//   { "v": 1, "commands": [{ "command": "/allow", "title": "Allow", ... }] }
// Array order is the ranking priority; the client assigns priority = index+1
// at parse time. See docs/bot-command-manifests.md for the wire contract.

export const BOT_COMMANDS_CONTACT_KEY = 'bot-commands';

// Manifest-local ceilings. The backend additionally caps the whole jammed
// profile (all fields) at 10kB, so publishers treat poke rejection as a
// real, non-fatal outcome.
export const BOT_COMMANDS_MAX_RAW_BYTES = 6000;
export const BOT_COMMANDS_MAX_ENTRIES = 32;
export const BOT_COMMANDS_MAX_COMMAND_CHARS = 32;
export const BOT_COMMANDS_MAX_TITLE_CHARS = 64;
export const BOT_COMMANDS_MAX_SUBTITLE_CHARS = 160;
export const BOT_COMMANDS_MAX_ICON_CHARS = 32;
export const BOT_COMMANDS_MAX_KEYWORDS = 8;
export const BOT_COMMANDS_MAX_KEYWORD_CHARS = 32;
export const BOT_COMMANDS_MAX_INSERT_TEXT_CHARS = 128;

// Any token that does not match this shape can never trigger the slash
// command popup (see computeSlashCommandState), so such entries are dropped
// at parse time.
const BOT_COMMAND_TOKEN_PATTERN = new RegExp(
  `^\\/[a-zA-Z0-9-]{1,${BOT_COMMANDS_MAX_COMMAND_CHARS}}$`
);

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/**
 * Parse an advertised bot-command manifest off a synced contact record.
 * Takes `unknown` — the value comes from the network and the TS declaration
 * of the contact field proves nothing at runtime. Returns null when the
 * manifest is absent, malformed, or has no valid entries; callers fall back
 * to the static manifest in that case.
 */
export function parseBotCommandManifest(
  raw: unknown
): SlashCommandManifest | null {
  if (typeof raw !== 'string') {
    return null;
  }
  if (utf8ByteLength(raw) > BOT_COMMANDS_MAX_RAW_BYTES) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const manifest = parsed as Record<string, unknown>;
  if (manifest.v !== 1) {
    return null;
  }
  if (!Array.isArray(manifest.commands)) {
    return null;
  }

  const commands: SlashCommandOption[] = [];
  const seenCommands = new Set<string>();
  // The cap is on wire entries, not survivors: entries past the first 32 are
  // never read, so invalid or duplicate ones inside the window do not let a
  // later entry through.
  for (const entry of manifest.commands.slice(0, BOT_COMMANDS_MAX_ENTRIES)) {
    const option = parseBotCommandEntry(entry);
    if (option === null) {
      continue;
    }
    // Duplicate tokens: keep the first occurrence.
    if (seenCommands.has(option.command)) {
      continue;
    }
    seenCommands.add(option.command);
    option.priority = commands.length + 1;
    commands.push(option);
  }

  if (commands.length === 0) {
    return null;
  }
  return { commands };
}

function parseBotCommandEntry(entry: unknown): SlashCommandOption | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;

  if (
    typeof record.command !== 'string' ||
    !BOT_COMMAND_TOKEN_PATTERN.test(record.command)
  ) {
    return null;
  }
  if (!isCappedString(record.title, BOT_COMMANDS_MAX_TITLE_CHARS)) {
    return null;
  }

  const option: SlashCommandOption = {
    command: record.command as `/${string}`,
    title: record.title,
    priority: 0,
  };

  if (record.subtitle !== undefined) {
    if (!isCappedString(record.subtitle, BOT_COMMANDS_MAX_SUBTITLE_CHARS)) {
      return null;
    }
    option.subtitle = record.subtitle;
  }
  if (record.icon !== undefined) {
    if (!isCappedString(record.icon, BOT_COMMANDS_MAX_ICON_CHARS)) {
      return null;
    }
    option.icon = record.icon;
  }
  if (record.insertText !== undefined) {
    if (
      !isCappedString(record.insertText, BOT_COMMANDS_MAX_INSERT_TEXT_CHARS)
    ) {
      return null;
    }
    option.insertText = record.insertText;
  }
  if (record.keywords !== undefined) {
    if (!Array.isArray(record.keywords)) {
      return null;
    }
    if (record.keywords.length > BOT_COMMANDS_MAX_KEYWORDS) {
      return null;
    }
    const keywords: string[] = [];
    for (const keyword of record.keywords) {
      if (!isCappedString(keyword, BOT_COMMANDS_MAX_KEYWORD_CHARS)) {
        return null;
      }
      keywords.push(keyword);
    }
    option.keywords = keywords;
  }

  return option;
}

// Caps count code points, not UTF-16 code units: an astral character (emoji,
// most CJK extensions) is one character to a publisher but two `.length` units.
function isCappedString(value: unknown, maxChars: number): value is string {
  return typeof value === 'string' && Array.from(value).length <= maxChars;
}

// ── Static fallback manifest ────────────────────────────────────────────────

const OPENCLAW_COMMANDS: SlashCommandOption[] = [
  {
    command: '/owner-listen',
    title: 'Owner listen',
    subtitle: 'Let the owner session listen in this channel',
    icon: 'Command',
    keywords: ['owner', 'listen', 'agent'],
    priority: 1,
  },
  {
    command: '/status',
    title: 'Status',
    subtitle: 'Show the current OpenClaw session status',
    icon: 'Info',
    keywords: ['openclaw', 'session', 'model'],
    priority: 2,
  },
  {
    command: '/help',
    title: 'Help',
    subtitle: 'Show available OpenClaw commands',
    icon: 'Info',
    keywords: ['openclaw', 'commands'],
    priority: 3,
  },
  {
    command: '/new',
    title: 'New session',
    subtitle: 'Start a fresh OpenClaw session',
    icon: 'Add',
    keywords: ['reset', 'session', 'openclaw'],
    priority: 4,
  },
  {
    command: '/pending',
    title: 'Pending approvals',
    subtitle: 'List pending DM, channel, and group requests',
    icon: 'Clock',
    keywords: ['approval', 'requests', 'owner'],
    priority: 5,
  },
  {
    command: '/allow',
    title: 'Allow request',
    subtitle: 'Approve a pending request by id',
    icon: 'Checkmark',
    keywords: ['approve', 'approval', 'request'],
    priority: 6,
  },
  {
    command: '/reject',
    title: 'Reject request',
    subtitle: 'Decline a pending request by id',
    icon: 'Close',
    keywords: ['deny', 'decline', 'approval', 'request'],
    priority: 7,
  },
  {
    command: '/ban',
    title: 'Ban request',
    subtitle: 'Block a ship and deny its pending request',
    icon: 'EyeClosed',
    keywords: ['block', 'deny', 'ship', 'approval'],
    priority: 8,
  },
  {
    command: '/banned',
    title: 'Banned ships',
    subtitle: 'List currently banned ships',
    icon: 'EyeClosed',
    keywords: ['blocked', 'ships', 'list'],
    priority: 9,
  },
  {
    command: '/unban',
    title: 'Unban ship',
    subtitle: 'Remove a ship from the ban list',
    icon: 'EyeOpen',
    keywords: ['unblock', 'ship', 'allow'],
    priority: 10,
  },
  {
    command: '/tlon-version',
    title: 'Tlon plugin version',
    subtitle: 'Show the installed OpenClaw Tlon plugin version',
    icon: 'Info',
    keywords: ['version', 'plugin', 'openclaw'],
    priority: 11,
  },
];

const STATIC_MANIFESTS: Record<BotAgentType, SlashCommandManifest> = {
  openclaw: { agent: 'openclaw', commands: OPENCLAW_COMMANDS },
};

export function isBotAgentType(value: unknown): value is BotAgentType {
  return value === 'openclaw';
}

export function getStaticSlashCommandManifest(
  agent: BotAgentType
): SlashCommandManifest {
  // Defensive: a stale persisted value is as untrusted as a network response
  // if the enum ever evolves, so fall back to openclaw for any unrecognized
  // agent value.
  return isBotAgentType(agent)
    ? STATIC_MANIFESTS[agent]
    : STATIC_MANIFESTS.openclaw;
}
