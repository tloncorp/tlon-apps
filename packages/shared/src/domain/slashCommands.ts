export type BotAgentType = 'openclaw' | 'hermes';

export interface SlashCommandOption {
  command: `/${string}`;
  title: string;
  subtitle?: string;
  // Icon NAME string, not an IconType: the shared layer must not depend on
  // @tloncorp/ui. The popup maps the string to an IconType with a 'Command'
  // fallback; packages/app's icon test asserts every name here resolves.
  icon?: string;
  keywords?: string[];
  // Static tiebreaker only; ranking is otherwise driven by the query match.
  // This — not array position — is what orders the popup (rankSlashCommands).
  priority: number;
  // Defaults to `${command} ` when omitted.
  insertText?: string;
}

export interface SlashCommandManifest {
  agent?: BotAgentType;
  commands: SlashCommandOption[];
}

// ── The bot-info identity claim ─────────────────────────────────────────────
// A bot publishes who it is — harness and versions — in its own contact
// profile, under BOT_INFO_CONTACT_KEY, as a %text value whose text is JSON:
//   {"v":1,"harness":"openclaw","version":"0.19.0","harnessVersion":"..."}
// The command lists themselves are app-static (below), selected by `harness`.
// See docs/bot-info.md for the wire contract.

export const BOT_INFO_CONTACT_KEY = 'bot-info';

// The claim is three short strings. These are abuse bounds on an identity
// field, not a data budget: nothing here should ever grow toward them.
export const BOT_INFO_MAX_RAW_BYTES = 512;
export const BOT_INFO_MAX_FIELD_CHARS = 64;

export interface BotInfo {
  // Matched case-sensitively against known harness ids by isBotAgentType.
  // Unknown values are kept (they are what the bot claims) but select the
  // fallback command list.
  harness: string;
  // The plugin/adapter's own version — first-party knowledge.
  version: string;
  // The underlying agent runtime's version. Optional by design: it is a
  // diagnostic rider on an identity claim, and a missing rider must never
  // invalidate the claim.
  harnessVersion?: string;
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/**
 * Parse a bot's identity claim off a synced contact record. Takes `unknown` —
 * the value comes from the network and the TS declaration of the contact field
 * proves nothing at runtime. Returns null when the claim is absent, malformed,
 * over-long, or the wrong version; callers then treat the bot as unidentified
 * and fall back to the default command list.
 */
export function parseBotInfo(raw: unknown): BotInfo | null {
  if (typeof raw !== 'string') {
    return null;
  }
  if (utf8ByteLength(raw) > BOT_INFO_MAX_RAW_BYTES) {
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

  const claim = parsed as Record<string, unknown>;
  if (claim.v !== 1) {
    return null;
  }

  const harness = readClaimField(claim.harness);
  const version = readClaimField(claim.version);
  if (harness === null || version === null) {
    return null;
  }

  const info: BotInfo = { harness, version };
  // Absent is fine; present-but-unusable is not — a claim carrying a number,
  // an array, or an empty string where a version string belongs is malformed.
  // Unknown object fields are ignored (forward compatibility).
  if (claim.harnessVersion !== undefined) {
    const harnessVersion = readClaimField(claim.harnessVersion);
    if (harnessVersion === null) {
      return null;
    }
    info.harnessVersion = harnessVersion;
  }
  return info;
}

// Caps count code points, not UTF-16 code units: an astral character (emoji,
// most CJK extensions) is one character to a publisher but two `.length` units.
function readClaimField(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  return Array.from(value).length <= BOT_INFO_MAX_FIELD_CHARS ? value : null;
}

// ── Static per-harness command lists ────────────────────────────────────────
// Each list is split into two explicitly named parts:
//
//   *_RUNTIME_COMMANDS — what the runtime itself handles. CI-bound: the shared
//     drift contract (runtimeCommandContract.test.ts) asserts these tokens
//     equal the runtime's committed token fixture, so adding, removing, or
//     duplicating a command in a runtime turns the contract red.
//   *_CORE_COMMANDS — host-provided commands the runtime neither registers nor
//     dispatches. No CI binding is possible (neither host exposes its registry
//     to us), so these are deliberate, audit-pinned constants: changing one
//     means re-auditing the host first.
//
// The split is display-neutral. Presentation order comes from `priority`
// (rankSlashCommands sorts by it and never by array position), so membership
// lives in the two arrays and ordering lives in the priorities.

const OPENCLAW_RUNTIME_COMMANDS: SlashCommandOption[] = [
  {
    command: '/owner-listen',
    title: 'Owner listen',
    subtitle: 'Let the owner session listen in this channel',
    icon: 'Command',
    keywords: ['owner', 'listen', 'agent'],
    priority: 1,
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
  {
    command: '/tlon',
    title: 'Tlon diagnostics',
    subtitle: 'Tlon plugin diagnostics. Usage: /tlon version',
    icon: 'Info',
    keywords: ['tlon', 'diagnostics', 'version'],
    priority: 12,
  },
  {
    command: '/migrate',
    title: 'Migrate diary to notes',
    subtitle: 'Run or clean up a diary-to-notes migration',
    icon: 'Copy',
    keywords: ['migrate', 'diary', 'notes', 'migration'],
    priority: 13,
  },
];

// OpenClaw core. Audit-verified against core at the plugin's dev pin
// (2026.5.28): the keys "help", "status", "new" in core's builtin command
// registry (src/auto-reply/commands-registry.shared.ts), which is exported from
// neither the package entry nor plugin-sdk and offers no runtime enumeration —
// hence a pinned constant rather than a CI-bound list. The plugin supports
// hosts >= 2026.5.7, older than the audited pin.
const OPENCLAW_CORE_COMMANDS: SlashCommandOption[] = [
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
];

const HERMES_RUNTIME_COMMANDS: SlashCommandOption[] = [
  {
    command: '/owner-listen',
    title: 'Owner listen',
    subtitle: 'Let the owner session listen in this channel',
    icon: 'Command',
    keywords: ['owner', 'listen', 'agent'],
    priority: 4,
  },
  {
    command: '/migrate',
    title: 'Migrate diary to notes',
    subtitle: 'Run or clean up a diary-to-notes migration',
    icon: 'Copy',
    keywords: ['migrate', 'diary', 'notes', 'migration'],
    priority: 5,
  },
  {
    command: '/tlon',
    title: 'Tlon diagnostics',
    subtitle: 'Tlon adapter diagnostics. Usage: /tlon version',
    icon: 'Info',
    keywords: ['tlon', 'diagnostics', 'version', 'status'],
    priority: 6,
  },
  {
    command: '/allow',
    title: 'Allow request',
    subtitle: 'Approve a pending request by id',
    icon: 'Checkmark',
    keywords: ['approve', 'approval', 'request'],
    priority: 7,
  },
  {
    command: '/reject',
    title: 'Reject request',
    subtitle: 'Decline a pending request by id',
    icon: 'Close',
    keywords: ['deny', 'decline', 'approval', 'request'],
    priority: 8,
  },
  {
    command: '/ban',
    title: 'Ban request',
    subtitle: 'Block a ship and deny its pending request',
    icon: 'EyeClosed',
    keywords: ['block', 'deny', 'ship', 'approval'],
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
    command: '/pending',
    title: 'Pending approvals',
    subtitle: 'List pending DM, channel, and group requests',
    icon: 'Clock',
    keywords: ['approval', 'requests', 'owner'],
    priority: 11,
  },
  {
    command: '/banned',
    title: 'Banned ships',
    subtitle: 'List currently banned ships',
    icon: 'EyeClosed',
    keywords: ['blocked', 'ships', 'list'],
    priority: 12,
  },
  {
    command: '/channel-access',
    title: 'Channel access',
    subtitle: 'Open or restrict a channel, or show its access status',
    icon: 'Lock',
    keywords: ['channel', 'access', 'open', 'restricted'],
    priority: 13,
  },
];

// Hermes core. Verified user-invocable by a source audit of the pinned
// hermes-agent runtime (tag v2026.6.19, commit 2bd1977): each is defined in
// core's command registry (hermes_cli/commands.py), dispatched by the gateway
// (gateway/run.py), not cli_only, and carries no per-command
// gateway_config_gate. Hermes' standard slash-access policy
// (gateway/slash_access.py) still applies on top: /help is always allowed, the
// other five can require admin or allowlisting — the same ceiling the adapter's
// own owner-only commands already sit under, so it changes nothing here. The
// ~40 other verified core commands work when typed but are not suggested.
const HERMES_CORE_COMMANDS: SlashCommandOption[] = [
  {
    command: '/help',
    title: 'Help',
    subtitle: 'Show available Hermes commands',
    icon: 'Info',
    keywords: ['hermes', 'commands'],
    priority: 1,
  },
  {
    command: '/status',
    title: 'Status',
    subtitle: 'Show the current Hermes session status',
    icon: 'Info',
    keywords: ['hermes', 'session', 'model'],
    priority: 2,
  },
  {
    command: '/new',
    title: 'New session',
    subtitle: 'Start a fresh Hermes session',
    icon: 'Add',
    keywords: ['reset', 'session', 'hermes'],
    priority: 3,
  },
  {
    command: '/stop',
    title: 'Stop',
    subtitle: 'Stop the work currently in flight',
    icon: 'Stop',
    keywords: ['halt', 'cancel', 'interrupt'],
    priority: 14,
  },
  {
    command: '/usage',
    title: 'Token usage',
    subtitle: 'Show token usage for this session',
    icon: 'Info',
    keywords: ['tokens', 'cost', 'usage'],
    priority: 15,
  },
  {
    command: '/model',
    title: 'Switch model',
    subtitle: 'Show or change the active model',
    icon: 'Settings',
    keywords: ['model', 'provider', 'switch'],
    priority: 16,
  },
];

// The CI-bound half of each list, keyed by harness. The drift contract reads
// this; nothing else should need it.
export const RUNTIME_COMMANDS: Record<BotAgentType, SlashCommandOption[]> = {
  openclaw: OPENCLAW_RUNTIME_COMMANDS,
  hermes: HERMES_RUNTIME_COMMANDS,
};

// Concatenation order is arbitrary — `priority` is what users see.
export const STATIC_MANIFESTS: Record<BotAgentType, SlashCommandManifest> = {
  openclaw: {
    agent: 'openclaw',
    commands: [...OPENCLAW_RUNTIME_COMMANDS, ...OPENCLAW_CORE_COMMANDS],
  },
  hermes: {
    agent: 'hermes',
    commands: [...HERMES_RUNTIME_COMMANDS, ...HERMES_CORE_COMMANDS],
  },
};

export function isBotAgentType(value: unknown): value is BotAgentType {
  return value === 'openclaw' || value === 'hermes';
}

/**
 * The command list for a harness id, as claimed in a bot's `bot-info`. An
 * unknown or absent harness gets the OpenClaw list: a claim we cannot place is
 * as untrusted as no claim at all, and third-party bots cannot advertise their
 * own commands under this design.
 */
export function getStaticSlashCommandManifest(
  harness: string | null | undefined
): SlashCommandManifest {
  return isBotAgentType(harness)
    ? STATIC_MANIFESTS[harness]
    : STATIC_MANIFESTS.openclaw;
}
