import commandCatalog from '@tloncorp/tlon-skill/scripts/command-catalog.json' with { type: 'json' };
import { locateOwnerShipConfig } from './owner-ship-config.js';
import { normalizeShip } from './targets.js';
import {
  ALLOWED_TLON_COMMANDS as ALLOWED_TLON_SUBCOMMANDS,
  checkBlockedDiaryOperation,
  checkBlockedMigrationOperation,
  checkBlockedSendOperation,
  findFirstPositionalArgumentIndex,
  formatAllowedTlonSubcommands,
  isAllowedTlonSubcommand,
  refusedDiaryNest,
} from './tlon-tool-guard.js';

export const ALLOWED_TLON_COMMANDS = new Set<string>(ALLOWED_TLON_SUBCOMMANDS);

const CREDENTIAL_FLAGS_WITH_VALUE = new Set([
  '--config',
  '--url',
  '--ship',
  '--code',
  '--cookie',
]);

const SELF_FLAG = '--self';

/** Families that only ever act as the bot (see resolveTlonActingIdentity). */
const BOT_ONLY_FAMILIES = new Set(['settings', 'browser']);

const PROFILE_UPDATE_FIELDS = [
  { flag: '--nickname', field: 'nickname' },
  { flag: '--bio', field: 'bio' },
  { flag: '--status', field: 'status' },
  { flag: '--avatar', field: 'avatar' },
  { flag: '--cover', field: 'cover' },
] as const;

export type TlonProfileUpdateField =
  (typeof PROFILE_UPDATE_FIELDS)[number]['field'];
export type TlonToolIntent = 'read' | 'write' | 'admin' | 'config' | 'utility';
export type TlonChannelKind = 'buckets' | 'chat' | 'heap' | 'notes';
export type TlonDmTargetKind = 'ship' | 'club' | 'unknown';
export type TlonUploadSource = 'url' | 'local' | 'stdin' | 'unknown';

export type TlonToolCallContext = {
  kind: 'tlonCommand';
  summaryKey: string;
  subcommand: string;
  operation: string;
  intent: TlonToolIntent;
  isKnownSubcommand: boolean;
  blockedSendOperation: boolean;
  channelKind?: TlonChannelKind;
  dmTargetKind?: TlonDmTargetKind;
  uploadSource?: TlonUploadSource;
  updateFields?: TlonProfileUpdateField[];
  inviteeCount?: number;
  memberCount?: number;
  contactCount?: number;
  roleCount?: number;
  hookCount?: number;
  hasDescription?: boolean;
  hasTitle?: boolean;
  hasContent?: boolean;
  hasImage?: boolean;
  hasNameChange?: boolean;
  hasSourceChange?: boolean;
  hasNest?: boolean;
  privacySetting?: 'public' | 'private' | 'secret';
  limit?: number;
  resolveCites?: boolean;
  scopedToChannel?: boolean;
  contentTypeProvided?: boolean;
};

const UNKNOWN_SUBCOMMAND = 'unknown';
const INVALID_OPERATION = 'invalid';

const ACTION_OPERATIONS_BY_SUBCOMMAND = new Map<string, ReadonlySet<string>>([
  [
    'activity',
    new Set([
      'mentions',
      'replies',
      'all',
      'unreads',
      'mute',
      'unmute',
      'volume',
    ]),
  ],
  ['browser', new Set(['handoff', 'share'])],
  [
    'buckets',
    new Set([
      'list',
      'show',
      'files',
      'search',
      'create',
      'mkdir',
      'upload',
      'read',
      'rename',
      'move',
      'delete',
      'set-writers',
    ]),
  ],
  [
    'channels',
    new Set([
      'dms',
      'group-dms',
      'groups',
      'all',
      'info',
      'create',
      'update',
      'rename',
      'delete',
      'leave',
      'join',
      'add-writers',
      'del-writers',
      'add-readers',
      'del-readers',
    ]),
  ],
  [
    'contacts',
    new Set([
      'list',
      'self',
      'get',
      'sync',
      'add',
      'remove',
      'del',
      'update',
      'update-profile',
    ]),
  ],
  [
    'dms',
    new Set([
      'send',
      'reply',
      'react',
      'unreact',
      'delete',
      'accept',
      'decline',
    ]),
  ],
  ['expose', new Set(['list', 'show', 'hide', 'check', 'url'])],
  [
    'groups',
    new Set([
      'list',
      'create',
      'create-owned',
      'invite',
      'info',
      'invite-link',
      'leave',
      'join',
      'request-invite',
      'accept-invite',
      'reject-invite',
      'cancel-join',
      'rescind-request',
      'revoke-invite',
      'delete',
      'update',
      'kick',
      'ban',
      'unban',
      'add-role',
      'delete-role',
      'update-role',
      'assign-role',
      'remove-role',
      'set-privacy',
      'accept-join',
      'reject-join',
      'promote',
      'demote',
      'add-channel',
      'add-section',
      'rename-section',
      'delete-section',
      'move-channel',
      'order-sections',
    ]),
  ],
  [
    'hooks',
    new Set([
      'init',
      'list',
      'get',
      'add',
      'edit',
      'delete',
      'del',
      'order',
      'config',
      'cron',
      'rest',
    ]),
  ],
  [
    'messages',
    new Set(['dm', 'channel', 'history', 'search', 'context', 'post']),
  ],
  [
    'notes',
    new Set([
      'status',
      'request',
      'list',
      'show',
      'notes',
      'note',
      'create',
      'note-create',
      'note-update',
      'note-rename',
      'note-move',
      'note-delete',
      'note-publish',
      'note-unpublish',
      'history',
      'folders',
      'folder',
      'folder-create',
      'folder-rename',
      'folder-move',
      'folder-delete',
      'members',
      'join',
      'leave',
      'migrate-plan',
      'migrate-apply',
      'notebook-delete',
    ]),
  ],
  [
    'posts',
    new Set([
      'send',
      'reply',
      'forward',
      'react',
      'unreact',
      'edit',
      'delete',
      'pin',
      'unpin',
    ]),
  ],
  [
    'settings',
    new Set([
      'get',
      'set',
      'delete',
      'del',
      'allow-dm',
      'add-dm',
      'remove-dm',
      'allow-channel',
      'add-channel',
      'remove-channel',
      'open-channel',
      'restrict-channel',
      'set-rule',
      'authorize-ship',
      'add-auth',
      'deauthorize-ship',
      'remove-auth',
    ]),
  ],
]);

/**
 * Shell-like argument splitter that respects quotes.
 */
export function shellSplitCommand(command: string): string[] {
  const args: string[] = [];
  let cur = '';
  let inDouble = false;
  let inSingle = false;
  let escape = false;

  for (const ch of command) {
    if (escape) {
      cur += ch;
      escape = false;
      continue;
    }
    if (ch === '\\' && !inSingle) {
      escape = true;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (/\s/.test(ch) && !inDouble && !inSingle) {
      if (cur) {
        args.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) {
    args.push(cur);
  }
  return args;
}

/**
 * Find the first positional argument (subcommand) by skipping credential flags
 * and their values. Returns the index into `args`, or -1 if none found.
 */
export function findTlonSubcommandIndex(args: string[]): number {
  return findFirstPositionalArgumentIndex(args, 0, CREDENTIAL_FLAGS_WITH_VALUE);
}

/**
 * `--self` is a plugin-level identity flag in the global-option position:
 * before the command family, alongside an optional leading `tlon` executable
 * token (the gate's rewrite is `--self tlon contacts …`; a model may write
 * `tlon --self contacts …`). Both are removed there. After the family, a
 * `--self` token is an ordinary argument (a title, a bio, a search query) and
 * is passed through untouched; only the operations in SELF_OPTION_POSITIONS,
 * whose CLI parsers accept their own `--self`, also read it as a bot request
 * where it is an option rather than a positional or an option's value.
 */
export function normalizeTlonCommandArgs(args: string[]): {
  args: string[];
  selfRequested: boolean;
  /** A credential flag in the global prefix, where the CLI reads one. */
  hasCredentialFlag: boolean;
} {
  const prefix: string[] = [];
  let selfRequested = false;
  let hasCredentialFlag = false;
  let removedExecutable = false;
  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    if (arg === SELF_FLAG) {
      selfRequested = true;
      index += 1;
      continue;
    }
    if (arg.toLowerCase() === 'tlon' && !removedExecutable) {
      removedExecutable = true;
      index += 1;
      continue;
    }
    if (isCredentialFlagToken(arg)) {
      hasCredentialFlag = true;
      prefix.push(arg);
      if (hasCredentialValue(args, index)) {
        prefix.push(args[index + 1]);
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }
    // Like the CLI's global-option parser, scanning stops at the first other
    // token: after the command family, credential-looking tokens are literal.
    break;
  }
  const rest = args.slice(index);
  if (hasOperationSelfFlag(rest)) selfRequested = true;
  return { args: [...prefix, ...rest], selfRequested, hasCredentialFlag };
}

function isCredentialFlagToken(arg: string): boolean {
  return CREDENTIAL_FLAGS_WITH_VALUE.has(arg.split('=', 1)[0]);
}

/** Whether the credential flag at `index` takes the next token as its value. */
function hasCredentialValue(args: string[], index: number): boolean {
  const next = args[index + 1];
  return (
    !args[index].includes('=') && next !== undefined && !next.startsWith('--')
  );
}

export function isBrowserHandoffCommand(args: string[]): boolean {
  // Redaction errs toward hiding: a `--self` anywhere does not shield a
  // browser capability from it.
  const normalized = normalizeTlonCommandArgs(
    args.filter((arg) => arg !== SELF_FLAG)
  ).args;
  const subIdx = findTlonSubcommandIndex(normalized);
  return (
    normalized[subIdx]?.toLowerCase() === 'browser' &&
    ['handoff', 'share'].includes(normalized[subIdx + 1]?.toLowerCase())
  );
}

/**
 * Redact a raw tool command for traces and Context Lens. Both record params
 * before the executor runs, so this is the only place that can keep a rejected
 * credential value or a browser capability out of logs.
 */
export function redactTlonCommand(command: string): string {
  const raw = shellSplitCommand(command);
  let redactedCredential = false;
  const tokens: string[] = [];
  // Only the global prefix carries credentials (see normalizeTlonCommandArgs);
  // after the command family the same spellings are literal values.
  let index = 0;
  let removedExecutable = false;
  for (; index < raw.length; index += 1) {
    const arg = raw[index];
    if (arg === SELF_FLAG) {
      tokens.push(arg);
      continue;
    }
    if (arg.toLowerCase() === 'tlon' && !removedExecutable) {
      removedExecutable = true;
      tokens.push(arg);
      continue;
    }
    if (!isCredentialFlagToken(arg)) break;
    const flag = arg.split('=', 1)[0];
    redactedCredential = true;
    if (arg.includes('=')) {
      tokens.push(`${flag}=[REDACTED]`);
      continue;
    }
    tokens.push(arg);
    // A following flag is not this flag's value: it is processed on its own.
    if (hasCredentialValue(raw, index)) {
      tokens.push('[REDACTED]');
      index += 1;
    }
  }
  tokens.push(...raw.slice(index));
  if (isBrowserHandoffCommand(tokens)) {
    const normalized = normalizeTlonCommandArgs(
      tokens.filter((arg) => arg !== SELF_FLAG)
    ).args;
    const subIdx = findTlonSubcommandIndex(normalized);
    // Keep only the operation: arguments can carry a signed viewer capability.
    return `browser ${normalized[subIdx + 1].toLowerCase()} [REDACTED]`;
  }
  return redactedCredential ? tokens.join(' ') : command;
}

export type BlockedTlonOperation = {
  message: string;
  reason:
    | 'diary_operation'
    | 'migration_operation'
    | 'send_operation'
    | 'credential_override'
    | 'owner_self_dm'
    | 'bot_ship_unknown'
    | 'owner_workspace_unsupported'
    | 'runtime_settings_key'
    | 'reserved_automatic_provision'
    | 'reserved_provider_configuration';
  diaryNest?: string;
};

function containsAutomaticProvisionAction(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsAutomaticProvisionAction);
  }
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.action && typeof record.action === 'object') {
    const event = (record.action as { event?: unknown }).event;
    if (
      event &&
      typeof event === 'object' &&
      (event as { name?: unknown }).name === 'tlon.provisionAgent'
    ) {
      return true;
    }
  }
  return Object.values(record).some(containsAutomaticProvisionAction);
}

function containsProviderConfigurationAction(value: unknown): boolean {
  if (Array.isArray(value))
    return value.some(containsProviderConfigurationAction);
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (
    record.event &&
    typeof record.event === 'object' &&
    (record.event as { name?: unknown }).name === 'tlon.configureAgentProviders'
  ) {
    return true;
  }
  return Object.values(record).some(containsProviderConfigurationAction);
}

function hasReservedBlobContent(
  args: string[],
  containsReservedContent: (value: unknown) => boolean
): boolean {
  if (args[0]?.toLocaleLowerCase() !== 'posts') return false;
  const blobs = args.flatMap((argument, index) => {
    if (argument === '--blob') return args[index + 1] ? [args[index + 1]!] : [];
    return argument.startsWith('--blob=')
      ? [argument.slice('--blob='.length)]
      : [];
  });
  return blobs.some((blob) => {
    try {
      return containsReservedContent(JSON.parse(blob));
    } catch {
      return false;
    }
  });
}

/**
 * Check blocked operations only after removing global credential flags.
 * Keeping that normalization here prevents a leading --config/--url prefix
 * from bypassing a guard that expects the subcommand at args[0].
 */
export function checkBlockedTlonOperation(
  args: string[]
): BlockedTlonOperation | null {
  const subIdx = findTlonSubcommandIndex(args);
  const commandArgs = subIdx >= 0 ? args.slice(subIdx) : [];
  if (hasReservedBlobContent(commandArgs, containsAutomaticProvisionAction)) {
    return {
      message:
        'Blocked: automatic recurring-task provisioning may be posted only by the typed tlon_agent_task_plan tool.',
      reason: 'reserved_automatic_provision',
    };
  }
  if (
    hasReservedBlobContent(commandArgs, containsProviderConfigurationAction)
  ) {
    return {
      message:
        'Blocked: provider access may be configured only by the verified onboarding coordinator.',
      reason: 'reserved_provider_configuration',
    };
  }
  const migration = checkBlockedMigrationOperation(commandArgs);
  if (migration) {
    return {
      message: migration,
      reason: 'migration_operation',
      diaryNest: refusedDiaryNest(commandArgs) ?? undefined,
    };
  }
  const diary = checkBlockedDiaryOperation(commandArgs);
  if (diary) {
    return {
      message: diary.message,
      reason: 'diary_operation',
      diaryNest: diary.nest,
    };
  }
  const send = checkBlockedSendOperation(commandArgs);
  return send ? { message: send, reason: 'send_operation' } : null;
}

const HELP_TOKENS = new Set(['-h', '--help']);

function isHelpToken(arg: string | undefined): boolean {
  return arg !== undefined && HELP_TOKENS.has(arg);
}

function anyHelpToken(args: string[]): boolean {
  return args.some(isHelpToken);
}

/** The CLI's message-boundary search: the first matching token anywhere. */
function boundaryIndex(args: string[], isBoundary: (arg: string) => boolean) {
  const index = args.findIndex(isBoundary);
  return index === -1 ? args.length : index;
}

const isImageFlag = (arg: string) =>
  arg === '--image' || arg.startsWith('--image=');
const isPostSendBoundary = (arg: string) =>
  [
    '--blob',
    '--title',
    '--sent-at',
    '--bot',
    '--quote',
    '--quote-parent',
  ].includes(arg) || isImageFlag(arg);
const isPostReplyBoundary = (arg: string) =>
  [
    '--author',
    '--blob',
    '--sent-at',
    '--bot',
    '--quote',
    '--quote-parent',
  ].includes(arg);
const isDmSendBoundary = (arg: string) => arg === '--bot' || isImageFlag(arg);
const isDmReplyBoundary = (arg: string) => arg === '--bot';

function isPostsMessageHelpLiteral(rest: string[]): boolean {
  const [operation, first, second] = rest;
  if (operation === 'edit') {
    return !!first && !!second && anyHelpToken(rest.slice(3));
  }
  if (operation === 'send') {
    return (
      !!first &&
      anyHelpToken(rest.slice(2, boundaryIndex(rest, isPostSendBoundary)))
    );
  }
  if (operation === 'reply') {
    return (
      !!first &&
      !!second &&
      anyHelpToken(rest.slice(3, boundaryIndex(rest, isPostReplyBoundary)))
    );
  }
  return false;
}

function isDmsMessageHelpLiteral(rest: string[]): boolean {
  const [operation, first, second] = rest;
  if (operation === 'send') {
    return (
      !!first &&
      anyHelpToken(rest.slice(2, boundaryIndex(rest, isDmSendBoundary)))
    );
  }
  if (operation === 'reply') {
    return (
      !!first &&
      !!second &&
      anyHelpToken(rest.slice(3, boundaryIndex(rest, isDmReplyBoundary)))
    );
  }
  return false;
}

function isSearchQueryHelpLiteral(rest: string[]): boolean {
  if (rest[0] !== 'search' || !isHelpToken(rest[1])) return false;
  const channelIndex = rest.indexOf('--channel', 2);
  if (channelIndex === -1) return false;
  const channel = rest[channelIndex + 1];
  return !!channel && !channel.startsWith('--');
}

/**
 * Whether the CLI answers this invocation with help instead of running it.
 * A help token is not always help, so this mirrors each family's dispatcher in
 * the tlon skill (it cannot be imported: the legacy modules run on import).
 *
 * | Family                                       | The CLI prints help when                                                 |
 * | -------------------------------------------- | ------------------------------------------------------------------------ |
 * | contacts, channels, hooks, groups            | `<op>` is a help token, or the arguments are exactly `<op> <help>`       |
 * | groups invite-link                           | as groups, or any help token after `invite-link`                         |
 * | activity, browser, settings, upload          | any help token                                                           |
 * | buckets, notes, expose                       | `<op>` is a help token, or any help token after `<op>`                   |
 * | posts                                        | as buckets, except inside `send`/`reply`/`edit` message text (content)   |
 * | dms                                          | as buckets, except inside `send`/`reply` message text (content)          |
 * | messages                                     | as buckets, except `search --help --channel <nest>` (a literal query)    |
 * | version                                      | always                                                                   |
 *
 * Where a family would reject the arguments instead, classifying them as help
 * is harmless: nothing runs. Anything not classified as help is a real
 * command: it runs under the chosen identity and is echoed.
 */
export function isTlonHelpInvocation(commandArgs: string[]): boolean {
  const family = commandArgs[0];
  const rest = commandArgs.slice(1);
  const operationHelp = isHelpToken(rest[0]);
  const exactOperationHelp = rest.length === 2 && isHelpToken(rest[1]);
  switch (family) {
    case 'version':
      return true;
    case 'contacts':
    case 'channels':
    case 'hooks':
      return operationHelp || exactOperationHelp;
    case 'groups':
      return (
        operationHelp ||
        exactOperationHelp ||
        (rest[0] === 'invite-link' && anyHelpToken(rest.slice(1)))
      );
    case 'activity':
    case 'browser':
    case 'settings':
    case 'upload':
      return anyHelpToken(rest);
    case 'buckets':
    case 'notes':
    case 'expose':
      return operationHelp || anyHelpToken(rest.slice(1));
    case 'posts':
      return (
        operationHelp ||
        (anyHelpToken(rest.slice(1)) && !isPostsMessageHelpLiteral(rest))
      );
    case 'dms':
      return (
        operationHelp ||
        (anyHelpToken(rest.slice(1)) && !isDmsMessageHelpLiteral(rest))
      );
    case 'messages':
      return (
        operationHelp ||
        (anyHelpToken(rest.slice(1)) && !isSearchQueryHelpLiteral(rest))
      );
    default:
      return false;
  }
}

/** `help`, `help <family>` or `help <family> <operation>`, nothing longer. */
function isValidHelpTarget(target: string[]): boolean {
  const [family, operation] = target;
  if (target.length > 2 || !isAllowedTlonSubcommand(family)) return false;
  if (family === 'help' || family === 'version') return false;
  return (
    operation === undefined ||
    (ACTION_OPERATIONS_BY_SUBCOMMAND.get(family)?.has(operation) ?? false)
  );
}

export type TlonActingIdentity =
  | { actAs: 'owner'; ship: string; prefix: string[] }
  | { actAs: 'bot' };

/**
 * Commands act as the owner by default. The bot acts for `settings` and
 * `browser` (bot-only), `--self`, help and version, and when no owner is
 * configured. A configured owner without a credential file is an error, never
 * a silent fall back to the bot.
 *
 * `--ship <owner>`, never `--config <path>`: ship-only resolution validates the
 * file's ship and its cookie-derived ship against the requested owner, so a
 * stale owner-named file holding bot credentials hard-fails instead of quietly
 * acting as the bot.
 */
export function resolveTlonActingIdentity(
  commandArgs: string[],
  selfRequested: boolean,
  isHelp: boolean,
  deps: Pick<TlonToolExecutorDeps, 'ownerShip' | 'env' | 'fileExists'>
): TlonActingIdentity | { error: string } {
  const ownerShip = deps.ownerShip?.trim();
  if (
    BOT_ONLY_FAMILIES.has(commandArgs[0] ?? '') ||
    selfRequested ||
    isHelp ||
    !ownerShip
  ) {
    return { actAs: 'bot' };
  }
  return ownerIdentityOrError(ownerShip, deps);
}

function ownerIdentityOrError(
  ownerShip: string | undefined,
  deps: Pick<TlonToolExecutorDeps, 'env' | 'fileExists'>
): TlonActingIdentity | { error: string } {
  const unprovisioned = (owner: string, detail: string) => ({
    error: `Error: owner credentials for ${owner} are not provisioned (${detail}); nothing was run. Add --self only if the bot's own account is what was asked for.`,
  });
  if (!ownerShip) {
    return unprovisioned('the owner', 'no owner ship is configured');
  }
  const location = locateOwnerShipConfig(ownerShip, deps);
  if (location.kind === 'found') {
    return { actAs: 'owner', ship: ownerShip, prefix: ['--ship', ownerShip] };
  }
  return unprovisioned(
    ownerShip,
    location.kind === 'no-skill-dir'
      ? 'TLON_SKILL_DIR is not set'
      : `expected ${location.configPath}`
  );
}

// TODO(TLON-6867 cleanup): remove with the `ownerDefault` flag. With the flag
// off, only these operations act as the owner, exactly as before owner-default
// commands: unless the command carries `--self`, a credential flag or a help
// token. Everything else acts as the bot or as the credentials it was given.
const LEGACY_OWNER_OPERATIONS = new Set([
  'groups invite-link',
  'notes note-publish',
  'notes note-unpublish',
  'activity mute',
  'activity unmute',
  'activity volume',
]);

/**
 * Operations whose CLI parsers accept their own `--self`, so the plugin also
 * reads one after the operation as a bot request in both flag states: the
 * legacy owner operations, and the workspace and channel creates whose
 * owner-hosting (or, with the flag off, owner routing) it opts out of. For
 * each, where its options start (index into `[family, operation, …]`) and
 * which of them take the next token as a value, mirroring the CLI's parse:
 *
 * - The legacy operations take no value options, and their parsers consume a
 *   `--self` token anywhere as the flag (`activity volume --self <target>
 *   <level>` is valid), so every token after the operation is an option
 *   position; none of their positionals (a flag, nest, id, target or level)
 *   can be a literal `--self`.
 * - create-owned: the title at 2, then `--admin`, `--owner` and
 *   `--description` with values (getCreateOwnedAdmin in tlon-skill).
 * - channels create, groups add-channel: the group at 2 and the title at 3,
 *   then `--kind` and `--description` with values (getOption from 3).
 */
const NO_VALUE_OPTIONS: ReadonlySet<string> = new Set();
const SELF_OPTION_POSITIONS = new Map<
  string,
  { start: number; valueOptions: ReadonlySet<string> }
>([
  ...[...LEGACY_OWNER_OPERATIONS].map(
    (operation) =>
      [operation, { start: 2, valueOptions: NO_VALUE_OPTIONS }] as const
  ),
  [
    'groups create-owned',
    {
      start: 3,
      valueOptions: new Set(['--admin', '--owner', '--description']),
    },
  ],
  [
    'channels create',
    { start: 4, valueOptions: new Set(['--kind', '--description']) },
  ],
  [
    'groups add-channel',
    { start: 4, valueOptions: new Set(['--kind', '--description']) },
  ],
]);

/**
 * Whether `[family, operation, …]` carries the operation's own `--self`
 * option, read where the CLI reads options: not a positional, not a value.
 */
function hasOperationSelfFlag(commandArgs: string[]): boolean {
  const operation =
    `${commandArgs[0] ?? ''} ${commandArgs[1] ?? ''}`.toLowerCase();
  const positions = SELF_OPTION_POSITIONS.get(operation);
  if (!positions) return false;
  for (let i = positions.start; i < commandArgs.length; i += 1) {
    if (commandArgs[i] === SELF_FLAG) return true;
    if (positions.valueOptions.has(commandArgs[i])) i += 1;
  }
  return false;
}

function resolveLegacyActingIdentity(
  commandArgs: string[],
  selfRequested: boolean,
  hasCredentialFlag: boolean,
  deps: Pick<TlonToolExecutorDeps, 'ownerShip' | 'env' | 'fileExists'>
): TlonActingIdentity | { error: string } {
  const operation = `${commandArgs[0]?.toLowerCase() ?? ''} ${commandArgs[1]?.toLowerCase() ?? ''}`;
  if (
    !LEGACY_OWNER_OPERATIONS.has(operation) ||
    selfRequested ||
    hasCredentialFlag ||
    anyHelpToken(commandArgs)
  ) {
    return { actAs: 'bot' };
  }
  return ownerIdentityOrError(deps.ownerShip?.trim() || undefined, deps);
}

const CREDENTIAL_FLAG_MESSAGE =
  'Error: credential flags (--config, --ship, --url, --code, --cookie) are not accepted. Commands run as the owner by default; add --self to run as this bot.';
const BOT_ONLY_CREDENTIAL_FLAG_MESSAGE =
  'Error: credential flags (--config, --ship, --url, --code, --cookie) are not accepted on settings or browser; these commands always run as this bot.';
const INVALID_DISCOVERY_MESSAGE =
  'Error: help takes a command and an optional operation, for example help posts send.';
const BOT_SHIP_UNKNOWN_MESSAGE =
  "Blocked: this bot's own ship could not be determined, so owner posts/dms commands are refused. Add --self to act as the bot.";

const OWNER_SELF_DM_FAMILIES = new Set(['posts', 'dms']);

/**
 * Owner-credentialed posts/dms aimed at the bot's own ship would act in the
 * owner's DM with the bot — where the owner's messages and reactions answer
 * approval requests. Refused outright; `--self` (the bot acting) is exempt.
 */
export function checkOwnerSelfDm(
  commandArgs: string[],
  ownerCredentialed: boolean,
  botShip: string | undefined
): BlockedTlonOperation | null {
  if (!ownerCredentialed || !OWNER_SELF_DM_FAMILIES.has(commandArgs[0] ?? '')) {
    return null;
  }
  const bot = normalizeShip(botShip ?? '');
  if (!bot) {
    return { message: BOT_SHIP_UNKNOWN_MESSAGE, reason: 'bot_ship_unknown' };
  }
  // A forward names its target after the source post.
  const target = commandArgs[commandArgs[1] === 'forward' ? 4 : 2];
  return target && normalizeShip(target) === bot
    ? {
        message: `Blocked: commands run as the owner cannot act in the owner's DM with this bot (${bot}). Reply to the owner with the message tool.`,
        reason: 'owner_self_dm',
      }
    : null;
}

// Keys the runtime owns: who can reach the bot and pending owner consent.
const RUNTIME_OWNED_SETTINGS_KEYS: Record<string, string> = {
  dmAllowlist: ' Use settings allow-dm or remove-dm.',
  defaultAuthorizedShips: ' Use settings authorize-ship or deauthorize-ship.',
  groupChannels: ' Use settings allow-channel or remove-channel.',
  channelRules: ' Use settings open-channel, restrict-channel or set-rule.',
  ownerShip: " It is set in the bot's configuration by its operator.",
  pendingApprovals:
    ' Approvals are answered by the owner, by reaction or /allow.',
};

export function checkRuntimeSettingsKey(
  commandArgs: string[]
): BlockedTlonOperation | null {
  if (
    commandArgs[0] !== 'settings' ||
    !['set', 'delete', 'del'].includes(commandArgs[1] ?? '')
  ) {
    return null;
  }
  const key = commandArgs[2] ?? '';
  if (!Object.hasOwn(RUNTIME_OWNED_SETTINGS_KEYS, key)) return null;
  return {
    message: `Blocked: settings key '${key}' controls who can reach this bot and cannot be set or deleted through the tlon tool.${RUNTIME_OWNED_SETTINGS_KEYS[key]}`,
    reason: 'runtime_settings_key',
  };
}

export function isMutatingTlonCommand(summary: TlonToolCallContext): boolean {
  return (
    summary.intent === 'write' ||
    summary.intent === 'admin' ||
    summary.intent === 'config'
  );
}

function formatActingIdentityEcho(
  identity: TlonActingIdentity,
  botShip: string | undefined
): string {
  if (identity.actAs === 'owner') return `Ran as ${identity.ship} (owner).`;
  const bot = normalizeShip(botShip ?? '');
  return bot ? `Ran as ${bot} (bot).` : 'Ran as this bot.';
}

const CREATE_OWNED_VALUE_OPTIONS = new Set([
  '--admin',
  '--owner',
  '--description',
]);

/**
 * Where create-owned's admin option sits in `commandArgs`, found as the CLI
 * finds it: options follow the title and each takes the next token as its
 * value, and `--admin` wins over its legacy alias `--owner`. When the options
 * read that way name no admin, the first `--owner` anywhere still counts, as
 * it did before `--admin` existed. -1 when there is none.
 */
function createOwnedAdminIndex(commandArgs: string[]): number {
  let admin = -1;
  let owner = -1;
  for (let i = 3; i < commandArgs.length; i += 1) {
    if (!CREATE_OWNED_VALUE_OPTIONS.has(commandArgs[i])) continue;
    if (commandArgs[i + 1] !== undefined) {
      if (commandArgs[i] === '--admin' && admin < 0) admin = i;
      if (commandArgs[i] === '--owner' && owner < 0) owner = i;
    }
    i += 1;
  }
  if (admin >= 0) return admin;
  if (owner >= 0) return owner;
  const legacy = commandArgs.indexOf('--owner', 3);
  return legacy >= 0 && commandArgs[legacy + 1] !== undefined ? legacy : -1;
}

// Develop's owner-routing predicates scan every token for a credential flag,
// as the Hermes adapter does; with `ownerDefault` credential flags are
// rejected before they run, so this only matters with the flag off.
function hasCredentialOverride(args: string[]): boolean {
  return args.some(isCredentialFlagToken);
}

function isCreateOwnedCommand(args: string[]): boolean {
  const subIdx = findTlonSubcommandIndex(args);
  return (
    subIdx >= 0 &&
    args[subIdx]?.toLowerCase() === 'groups' &&
    args[subIdx + 1]?.toLowerCase() === 'create-owned'
  );
}

/**
 * The command with its admin spelled `--owner` right after the title, which
 * every CLI reads: one that predates `--admin` rejects it, and a newer one
 * takes `--owner` as its alias. For a create-owned run as written on the bot's
 * own credentials. A CLI reading only `--owner` takes the token after the
 * first one, even when that `--owner` is a description's value, so the admin
 * the CLI would have chosen goes first, then the description the CLI reads,
 * and every other admin, owner or description pair is dropped. Other tokens
 * stay, after them.
 */
function withLegacyAdminSpelling(args: string[]): string[] {
  const subIdx = findTlonSubcommandIndex(args);
  const commandArgs = args.slice(subIdx);
  const adminIndex = createOwnedAdminIndex(commandArgs);
  if (adminIndex < 0) return args;

  const rest: string[] = [];
  for (let i = 3; i < commandArgs.length; i += 1) {
    if (CREATE_OWNED_VALUE_OPTIONS.has(commandArgs[i])) i += 1;
    else rest.push(commandArgs[i]);
  }
  return [
    ...args.slice(0, subIdx),
    ...commandArgs.slice(0, 3),
    '--owner',
    commandArgs[adminIndex + 1],
    ...descriptionArgs(commandArgs),
    ...rest,
  ];
}

/**
 * Whether a create-owned run on the bot's own credentials names the bot as
 * its admin. A credential flag or a help token leaves the command as written.
 */
function namesOwnShipAdmin(args: string[], botShip: string): boolean {
  if (hasCredentialOverride(args)) return false;
  const subIdx = findTlonSubcommandIndex(args);
  const commandArgs = args.slice(subIdx);
  if (commandArgs.some((arg) => HELP_TOKENS.has(arg))) return false;
  const adminIndex = createOwnedAdminIndex(commandArgs);
  return (
    adminIndex >= 0 && normalizeShip(commandArgs[adminIndex + 1]) === botShip
  );
}

/**
 * A bot that is its own owner already hosts what it makes, and create-owned
 * refuses an admin who is the host, so its "workspace for the owner" is a
 * plain create with the same title and description.
 */
function asPlainCreate(args: string[]): string[] {
  const subIdx = findTlonSubcommandIndex(args);
  const commandArgs = args.slice(subIdx);
  return [
    ...args.slice(0, subIdx),
    commandArgs[0],
    'create',
    commandArgs[2],
    ...descriptionArgs(commandArgs),
  ];
}

/**
 * create-owned's description as the CLI reads it, the token after the first
 * `--description`, as an option pair to rebuild a command with.
 */
function descriptionArgs(commandArgs: string[]): string[] {
  const index = commandArgs.indexOf('--description', 3);
  const description = index >= 0 ? commandArgs[index + 1] : undefined;
  return description !== undefined ? ['--description', description] : [];
}

/**
 * The shared owner-workspace predicate (the Hermes adapter implements the same
 * truth table, except that it reads any `--self` token as the option): a `groups create-owned` whose admin is the configured owner,
 * with no credential flag in either form, no `--self` option (a literal title
 * or value of `--self` does not count), and no help token.
 * create-owned is hosted by whoever runs it, so the bot makes its owner's
 * workspace on the owner's ship by running it as the owner with itself as the
 * admin. A moon cannot create a group on its parent.
 */
export function shouldCreateWorkspaceOnOwner(
  args: string[],
  ownerShip: string | undefined
): boolean {
  if (!ownerShip) return false;
  if (hasCredentialOverride(args)) return false;

  const subIdx = findTlonSubcommandIndex(args);
  if (subIdx < 0) return false;
  const commandArgs = args.slice(subIdx);
  if (commandArgs[0]?.toLowerCase() !== 'groups') return false;
  if (commandArgs[1]?.toLowerCase() !== 'create-owned') return false;
  if (
    hasOperationSelfFlag(commandArgs) ||
    commandArgs.some((arg) => HELP_TOKENS.has(arg))
  ) {
    return false;
  }

  const adminIndex = createOwnedAdminIndex(commandArgs);
  return (
    adminIndex >= 0 && normalizeShip(commandArgs[adminIndex + 1]) === ownerShip
  );
}

const CHANNEL_CREATE_COMMANDS: ReadonlyArray<readonly [string, string]> = [
  ['channels', 'create'],
  ['groups', 'add-channel'],
];

/**
 * The shared owner-channel predicate (the Hermes adapter implements the same
 * truth table, except that it reads any `--self` token as the option): a channel create in a group the configured owner hosts, with
 * no credential flag in either form, no `--self` option, and no help token. A channel
 * is hosted by the ship that creates it, so run as the bot — a non-host admin
 * there — it would land on the bot's ship instead of the owner's.
 */
export function shouldCreateChannelOnOwner(
  args: string[],
  ownerShip: string | undefined
): boolean {
  if (!ownerShip) return false;
  if (hasCredentialOverride(args)) return false;

  const subIdx = findTlonSubcommandIndex(args);
  if (subIdx < 0) return false;
  const commandArgs = args.slice(subIdx);
  const command = commandArgs[0]?.toLowerCase();
  const operation = commandArgs[1]?.toLowerCase();
  if (
    !CHANNEL_CREATE_COMMANDS.some(([c, o]) => c === command && o === operation)
  ) {
    return false;
  }
  if (
    hasOperationSelfFlag(commandArgs) ||
    commandArgs.some((arg) => HELP_TOKENS.has(arg))
  ) {
    return false;
  }

  const groupHost = commandArgs[2]?.split('/')[0];
  return !!groupHost && normalizeShip(groupHost) === ownerShip;
}

/**
 * A command routed to the owner, or the command as written plus a note for the
 * model saying why it stayed on the bot's ship and so who hosts the result.
 */
type OwnerRouting = { args: string[]; note?: string };

/**
 * Whether the owner's hosted credentials are provisioned. A missing file is
 * logged rather than an error: what the bot makes on its own ship still works,
 * and it is all a self-hosted bot can make.
 */
function ownerCredentialsProvisioned(
  deps: TlonToolExecutorDeps,
  ownerShip: string,
  what: string
): boolean {
  const location = locateOwnerShipConfig(ownerShip, deps);
  if (location.kind === 'no-config-file') {
    deps.logError?.(
      `Creating ${what} on the bot's ship: owner credentials are missing at ${location.configPath}.`
    );
  }
  return location.kind === 'found';
}

/**
 * The ship the CLI runs as: the one the plugin passes it, or else the one it
 * reads from the environment when the plugin relies on env credentials. A
 * config file named by TLON_CONFIG_FILE outranks those variables, and a
 * cookie alone names no ship here, so either leaves it unknown.
 */
function resolveBotShip(deps: TlonToolExecutorDeps): string | undefined {
  if (deps.botShip) return deps.botShip;
  const env = deps.env ?? process.env;
  if (env.TLON_CONFIG_FILE?.trim()) return undefined;
  const ship = env.URBIT_SHIP?.trim() || env.TLON_SHIP?.trim();
  return ship ? normalizeShip(ship) || undefined : undefined;
}

/**
 * Every create-owned goes through here. One for the configured owner runs as
 * the owner, rebuilt from what the CLI would read: `--ship <owner>`, the
 * title, `--admin <bot>`, then the description. Rebuilt rather than edited,
 * because a description's value can be an option name (a legacy `--description
 * --owner <ship>`, or an empty description the splitter dropped), and an
 * edited or appended admin would then be read as the description. Anything
 * else runs as written, with the admin spelled so any CLI reads it, and a
 * note when it was meant for the owner but stayed on the bot.
 */
async function routeCreateOwned(
  args: string[],
  selfRequested: boolean,
  deps: TlonToolExecutorDeps
): Promise<OwnerRouting> {
  const asWritten = withLegacyAdminSpelling(args);
  const ownerShip = deps.ownerShip;
  const botShip = resolveBotShip(deps);
  // Checked before --self opts out of routing: run as itself or not, a bot
  // that is its own owner would name itself admin, which create-owned refuses.
  if (botShip && botShip === ownerShip && namesOwnShipAdmin(args, botShip)) {
    return { args: asPlainCreate(args) };
  }
  if (
    !ownerShip ||
    selfRequested ||
    !shouldCreateWorkspaceOnOwner(args, ownerShip)
  ) {
    return { args: asWritten };
  }

  const fallback = `so this ran on your own ship: you host the workspace and ${ownerShip} is its admin.`;
  if (!botShip) {
    return {
      args: asWritten,
      note: `This bot's ship isn't configured here, ${fallback}`,
    };
  }
  if (!ownerCredentialsProvisioned(deps, ownerShip, 'the workspace')) {
    return {
      args: asWritten,
      note: `Your owner's credentials aren't available here, ${fallback}`,
    };
  }
  if (!(await cliSupportsAdminOption(deps))) {
    return {
      args: asWritten,
      note: `The installed tlon CLI's create-owned has no --admin, ${fallback}`,
    };
  }

  return { args: ownerHostedWorkspace(args, ownerShip, botShip) };
}

/**
 * Rebuilt from what the CLI would read: `--ship <owner>`, the title,
 * `--admin <bot>`, then the description (see routeCreateOwned).
 */
function ownerHostedWorkspace(
  args: string[],
  ownerShip: string,
  botShip: string
): string[] {
  const subIdx = findTlonSubcommandIndex(args);
  const commandArgs = args.slice(subIdx);
  return [
    '--ship',
    ownerShip,
    ...args.slice(0, subIdx),
    ...commandArgs.slice(0, 3),
    '--admin',
    botShip,
    ...descriptionArgs(commandArgs),
  ];
}

const OWNER_WORKSPACE_BOT_SHIP_UNKNOWN_MESSAGE =
  "Blocked: this bot's own ship could not be determined, so the workspace cannot be hosted on the owner's ship; nothing was run. Add --self to create a bot-hosted group instead.";
const OWNER_WORKSPACE_NO_ADMIN_OPTION_MESSAGE =
  "Blocked: the installed tlon CLI cannot host this workspace on the owner's ship (create-owned has no --admin); nothing was run. Add --self to create a bot-hosted group instead.";

/**
 * create-owned with `ownerDefault`: the identity is already chosen, so this
 * only fills in arguments. Run as the owner with the owner named as admin (the
 * model asking for "a workspace for my owner"), it is rebuilt with the bot as
 * admin, so the owner hosts it and the bot joins. A bot that is its own owner
 * naming itself makes a plain group, as with the flag off. Anything else runs
 * as written, with the admin spelled so any CLI reads it.
 *
 * Unlike the flag-off routing, nothing falls back to the bot's ship. Owner
 * credentials are already provisioned (the identity check fails closed
 * first), and the two remaining cases are refused: the bot's ship is unknown,
 * so it cannot be named admin; or the installed CLI's create-owned has no
 * --admin, so run as the owner it would make the owner its own admin.
 */
async function routeOwnerDefaultCreateOwned(
  command: string[],
  identity: TlonActingIdentity,
  deps: TlonToolExecutorDeps
): Promise<{ args: string[] } | { blocked: BlockedTlonOperation }> {
  const prefix = identity.actAs === 'owner' ? identity.prefix : [];
  const ownerShip = deps.ownerShip;
  const botShip = resolveBotShip(deps);
  if (botShip && botShip === ownerShip && namesOwnShipAdmin(command, botShip)) {
    return { args: [...prefix, ...asPlainCreate(command)] };
  }
  if (
    identity.actAs !== 'owner' ||
    !shouldCreateWorkspaceOnOwner(command, ownerShip)
  ) {
    return { args: [...prefix, ...withLegacyAdminSpelling(command)] };
  }

  const unsupported = (message: string) => ({
    blocked: { message, reason: 'owner_workspace_unsupported' as const },
  });
  if (!botShip) {
    return unsupported(OWNER_WORKSPACE_BOT_SHIP_UNKNOWN_MESSAGE);
  }
  if (!(await cliSupportsAdminOption(deps))) {
    return unsupported(OWNER_WORKSPACE_NO_ADMIN_OPTION_MESSAGE);
  }
  return { args: ownerHostedWorkspace(command, identity.ship, botShip) };
}

function routeChannelToOwner(
  args: string[],
  deps: TlonToolExecutorDeps
): OwnerRouting {
  const ownerShip = deps.ownerShip;
  if (!ownerShip || resolveBotShip(deps) === ownerShip) return { args };
  if (!ownerCredentialsProvisioned(deps, ownerShip, 'the channel')) {
    return {
      args,
      note: `Your owner's credentials aren't available here, so this channel is hosted on your own ship rather than ${ownerShip}'s.`,
    };
  }
  return { args: ['--ship', ownerShip, ...args] };
}

const ADMIN_OPTION_PROBE_ARGS = ['groups', 'create-owned', '--help'];
const ADMIN_OPTION_TOKEN = /(?<![\w-])--admin(?![\w-])/;

/**
 * Whether the installed CLI's create-owned takes --admin. An older one has
 * only --owner, which it hosts on the ship that runs it with the named ship as
 * admin; run as the owner with the owner named, that is no workspace for the
 * bot at all. The Hermes adapter probes the same way.
 */
async function cliSupportsAdminOption(
  deps: TlonToolExecutorDeps
): Promise<boolean> {
  let help = '';
  try {
    help = await deps.runCommand(ADMIN_OPTION_PROBE_ARGS);
  } catch {
    // A probe that did not run says nothing about support.
  }
  if (ADMIN_OPTION_TOKEN.test(help)) return true;
  deps.logError?.(
    "Creating the workspace on the bot's ship: the installed tlon CLI's groups create-owned does not take --admin."
  );
  return false;
}

export type TlonToolExecutorDeps = {
  runCommand: (args: string[]) => Promise<string>;
  notifyDiaryMigrationDiscovery: (nest: string) => Promise<boolean>;
  logError?: (message: string) => void;
  /** Configured owner ship, already normalized to `~ship`. */
  ownerShip?: string;
  /**
   * Staged rollout: true runs commands as the owner unless `--self` and
   * rejects credential flags; false keeps the bot as the default.
   */
  ownerDefault?: boolean;
  /**
   * The ship the runner's own credentials act as, when it can be known
   * (resolveExecutionBotShip), already normalized to `~ship`. Unknown refuses
   * owner posts/dms commands; routing also reads the environment
   * (resolveBotShip) when it is unset.
   */
  botShip?: string;
  env?: NodeJS.ProcessEnv;
  fileExists?: (path: string) => boolean;
};

/**
 * The model-facing identity guidance, which depends on the staged-rollout
 * flag. Shared by the tool description and discovery help.
 */
export function formatTlonIdentityGuidance(ownerDefault: boolean): string {
  return ownerDefault
    ? 'Commands act as your owner by default: reads return the owner\'s data and writes land on the owner\'s ship. Put --self before the command (for example --self contacts self) to act as this bot: its own DMs, profile, contacts, membership, hosted groups, and uploads you send with message. A workspace for your owner is groups create-owned "Name" --admin <your ship>: it runs as the owner, so the owner\'s ship hosts it and you are its admin (naming the owner as --admin is rewritten to you). A group you host yourself, for your own automation, is --self groups create-owned "Name" --admin <owner>. A --self after the command is an ordinary argument, except in groups create-owned, channels create, groups add-channel, groups invite-link, notes note-publish and note-unpublish, and activity mute, unmute and volume, where --self as an option (not a title or an option\'s value) also selects the bot. settings and browser always act as the bot. Credential flags are rejected. Only turns answering the owner act as the owner; scheduled jobs, the heartbeat and subagents act as the bot, and so does an answer to the owner while an earlier reply is still in progress (say so and let them ask again).'
    : 'Commands act as this bot. groups invite-link, notes note-publish and note-unpublish, and activity mute, unmute and volume act as the owner unless --self is given. Owner credentials from the documented owner configuration are accepted.';
}

/** Which commands read or change different data under each identity. */
const OWNER_DEFAULT_IDENTITY_TABLE = [
  'Owner or bot: decide which one the person means ("my DMs" is the owner\'s; "your profile" is the bot\'s).',
  "  channels dms|group-dms, messages dm|search: the owner's conversations; with --self, the bot's.",
  "  activity (incl. mute, unmute, volume): the owner's activity and notification levels; with --self, the bot's.",
  "  contacts self|list|add|remove|update|update-profile: the owner's profile and contact book; with --self, the bot's.",
  "  groups list|join|leave|accept-invite|reject-invite|request-invite, channels join|leave: the owner's membership; with --self, the bot's.",
  '  posts send|reply|forward to ~ship: a DM from the owner; with --self, from the bot (prefer message).',
  "  posts react|unreact|edit|delete: as the owner (edit only the owner's posts); with --self, as the bot.",
  "  dms react|unreact|delete: in the owner's DMs; with --self, in the bot's.",
  "  hooks: hooks in the owner's groups; with --self, in channels the bot hosts.",
  '  upload: an owner-hosted URL for content posted as the owner; with --self, a bot-hosted URL for images you send with message.',
];

/** The tool description; its identity guidance follows the rollout flag. */
export function formatTlonToolDescription(ownerDefault: boolean): string {
  return (
    'Read Tlon data and manage Tlon workspaces (groups), channels, notes, shared Bucket files, contacts, and settings. ' +
    formatTlonIdentityGuidance(ownerDefault) +
    ' ' +
    'In Tlon requests, "workspace" means a group; use groups commands and groups create-owned to create one for a user. Explicit requests about files or paths refer to the agent workspace directory. ' +
    'Read the tlon skill at its available-skills location for the task workflow. Use command "help" or "help <command> [operation]" to discover exact syntax. ' +
    'Pass arguments only, without a leading tlon executable. Relative files use the active agent workspace; shell expansion, pipes, redirections, and stdin are unavailable. ' +
    'Use message for ordinary sends/replies. To share a hosted browser for viewing or control, use browser share <session_id> to send a rich browser-session link card; never send raw or labeled browser-session links in ordinary messages. For secure browser input, use browser handoff <session_id> --fields <JSON array> with current snapshot refs when the owner should fill only selected controls; omit --fields for automatic discovery of the visible form. Use help browser for syntax and quoting examples. Both browser commands take the sess_ handle from browser_session_create, never a viewer URL. Legacy diary migrations require the owner’s /migrate command. ' +
    'Never use a browser to operate Tlon itself: if neither this tool nor message can do what was asked, say your Tlon tools do not support it yet and, where the Tlon app offers it, that the user can do it there. ' +
    'Verify the result and report any unresolved failure before ending the turn.'
  );
}

export function formatTlonToolHelp(ownerDefault = false): string {
  const commands = Object.entries(commandCatalog)
    .filter(([name]) => isAllowedTlonSubcommand(name))
    .map(
      ([name, entry]) => `  ${name}: ${entry.summary}. ${entry.toolGuidance}`
    );
  return [
    'Tlon tool — command discovery',
    'Usage: {"command":"<command> <operation> [arguments]"}',
    'Use {"command":"help notes"} or {"command":"help notes note-create"} for exact syntax.',
    formatTlonIdentityGuidance(ownerDefault),
    ...(ownerDefault ? OWNER_DEFAULT_IDENTITY_TABLE : []),
    'CLI usage may show a leading tlon: omit it in this tool. No shell expansion, pipes, redirects, or stdin.',
    'Relative file paths use the active agent workspace. Use message for ordinary sends/replies.',
    'Read the tlon skill at its discovered location for task-specific references.',
    '',
    ...commands,
  ].join('\n');
}

/** The command family after any credential flags, looking through `help`. */
function credentialAwareFamily(rawArgs: string[]): string | undefined {
  const args = normalizeTlonCommandArgs(rawArgs).args;
  const index = findTlonSubcommandIndex(args);
  const first = index >= 0 ? args[index] : undefined;
  return first === 'help' ? args[index + 1] : first;
}

function blockedResult(
  deps: TlonToolExecutorDeps,
  blocked: BlockedTlonOperation,
  subcommand: string | undefined
) {
  // Log the subcommand and nest, never params.command, which can carry
  // credential values or message text.
  deps.logError?.(
    `Blocked tlon tool operation: reason=${blocked.reason} subcommand=${subcommand ?? '(none)'}${
      blocked.diaryNest ? ` nest=${blocked.diaryNest}` : ''
    }`
  );
  return {
    content: [{ type: 'text' as const, text: blocked.message }],
    details: {
      status: 'blocked',
      blocked: true,
      reason: blocked.reason,
    },
  };
}

function errorResult(text: string) {
  const message = text.replace(/^Error: /, '');
  return {
    content: [{ type: 'text' as const, text }],
    details: { status: 'error', error: message },
  };
}

function withNote(text: string, note: string | undefined): string {
  return note ? `${text}\n\nNote: ${note}` : text;
}

export function createTlonToolExecutor(deps: TlonToolExecutorDeps) {
  return async function execute(_id: string, params: { command: string }) {
    try {
      const rawArgs = shellSplitCommand(params.command);
      const { hasCredentialFlag } = normalizeTlonCommandArgs(rawArgs);
      const family = credentialAwareFamily(rawArgs);
      // The only identities are the owner (default) and the bot (--self);
      // settings and browser are the bot's in both flag states.
      if (
        hasCredentialFlag &&
        (deps.ownerDefault || BOT_ONLY_FAMILIES.has(family ?? ''))
      ) {
        return blockedResult(
          deps,
          {
            message: deps.ownerDefault
              ? CREDENTIAL_FLAG_MESSAGE
              : BOT_ONLY_CREDENTIAL_FLAG_MESSAGE,
            reason: 'credential_override',
          },
          family
        );
      }

      const normalized = normalizeTlonCommandArgs(rawArgs);
      let args = normalized.args;
      // Discovery is found after any credential flags (allowed only with the
      // flag off), so they cannot hide a `help` rewrite from the guards.
      const discoveryIndex = findTlonSubcommandIndex(args);
      const credentialPrefix = args.slice(0, Math.max(0, discoveryIndex));
      const discoveryArgs = args.slice(Math.max(0, discoveryIndex));
      if (
        discoveryIndex < 0 ||
        (discoveryArgs.length === 1 &&
          ['help', '--help', '-h'].includes(discoveryArgs[0]))
      ) {
        return {
          content: [
            {
              type: 'text' as const,
              text: formatTlonToolHelp(Boolean(deps.ownerDefault)),
            },
          ],
          details: undefined,
        };
      }
      if (
        discoveryArgs.length === 1 &&
        ['version', '--version', '-v'].includes(discoveryArgs[0])
      ) {
        return {
          content: [
            {
              type: 'text' as const,
              text: await deps.runCommand(['--version']),
            },
          ],
          details: undefined,
        };
      }
      if (discoveryArgs[0] === 'help') {
        if (!isValidHelpTarget(discoveryArgs.slice(1))) {
          return errorResult(INVALID_DISCOVERY_MESSAGE);
        }
        args = [...credentialPrefix, ...discoveryArgs.slice(1), '--help'];
      }

      const subIdx = findTlonSubcommandIndex(args);
      const subcommand = subIdx >= 0 ? args[subIdx] : undefined;
      if (!isAllowedTlonSubcommand(subcommand)) {
        const message = `Unknown tlon subcommand '${subcommand ?? '(none)'}'. Allowed: ${formatAllowedTlonSubcommands()}. Use {"command":"help"} to discover commands; omit the leading tlon executable.`;
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          details: { status: 'error', error: message },
        };
      }

      const blocked = checkBlockedTlonOperation(args);
      if (blocked) {
        // The owner gate logs its denials; this one did not, leaving the more
        // interesting signal invisible — a model repeatedly attempting a
        // destructive migration on its own initiative.
        if (blocked.diaryNest) {
          void deps
            .notifyDiaryMigrationDiscovery(blocked.diaryNest)
            .catch((error) => {
              deps.logError?.(
                `Failed to notify owner about diary migration discovery for ${blocked.diaryNest}: ${String(error)}`
              );
            });
        }
        return blockedResult(deps, blocked, subcommand);
      }

      // Only inspect the option region, not titles or file names that happen
      // to contain the flag. CLI help remains available for these commands.
      const command = args.slice(subIdx);
      const optionStart =
        command[0] === 'upload'
          ? 1
          : command[0] === 'notes' && command[1] === 'note-create'
            ? 5
            : command[0] === 'notes' && command[1] === 'note-update'
              ? 4
              : command.length;
      if (
        !command.some((arg) => HELP_TOKENS.has(arg)) &&
        command
          .slice(optionStart)
          .some((arg) => arg === '--stdin' || arg.startsWith('--stdin='))
      ) {
        const message =
          'The tlon tool cannot supply stdin. Write content to a workspace file, then use notes note-create/note-update --body <file> or upload <file>. Shell pipes and redirections are not supported.';
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          details: { status: 'error', error: message },
        };
      }

      const isHelp = isTlonHelpInvocation(command);
      const identity = deps.ownerDefault
        ? resolveTlonActingIdentity(
            command,
            normalized.selfRequested,
            isHelp,
            deps
          )
        : resolveLegacyActingIdentity(
            command,
            normalized.selfRequested,
            hasCredentialFlag,
            deps
          );
      if ('error' in identity) {
        return errorResult(identity.error);
      }

      // Model-supplied credentials (allowed only with the flag off) are as
      // owner-capable as the owner prefix.
      const ownerCredentialed = identity.actAs === 'owner' || hasCredentialFlag;
      const guarded = isHelp
        ? null
        : (checkOwnerSelfDm(command, ownerCredentialed, deps.botShip) ??
          checkRuntimeSettingsKey(command));
      if (guarded) {
        return blockedResult(deps, guarded, subcommand);
      }

      // With the flag off, credential flags pass through in place.
      let runArgs =
        identity.actAs === 'owner' ? [...identity.prefix, ...command] : args;
      // Says where a command meant for the owner ran instead, so the model
      // can report the host. It asserts an outcome, so only a success gets it.
      let routingNote: string | undefined;
      if (deps.ownerDefault) {
        // The identity is already decided; create-owned only has its admin
        // filled in. Channel creates need no routing: they already run as
        // the owner unless --self.
        if (isCreateOwnedCommand(command)) {
          const routed = await routeOwnerDefaultCreateOwned(
            command,
            identity,
            deps
          );
          if ('blocked' in routed) {
            return blockedResult(deps, routed.blocked, subcommand);
          }
          runArgs = routed.args;
        }
      } else if (isCreateOwnedCommand(args)) {
        ({ args: runArgs, note: routingNote } = await routeCreateOwned(
          args,
          normalized.selfRequested,
          deps
        ));
      } else if (
        !normalized.selfRequested &&
        shouldCreateChannelOnOwner(args, deps.ownerShip)
      ) {
        ({ args: runArgs, note: routingNote } = routeChannelToOwner(
          args,
          deps
        ));
      }

      const output = withNote(await deps.runCommand(runArgs), routingNote);
      const echoes =
        deps.ownerDefault &&
        !isHelp &&
        isMutatingTlonCommand(summarizeKnownTlonCommand(command, false)) &&
        !output.trimStart().startsWith('Usage:');
      const text = echoes
        ? `${output.replace(/\s+$/, '')}${output.trim() ? '\n' : ''}${formatActingIdentityEcho(identity, deps.botShip)}`
        : output;
      return {
        content: [{ type: 'text' as const, text }],
        details: undefined,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        details: { status: 'error', error: message },
      };
    }
  };
}

export function summarizeTlonCommand(command: string): TlonToolCallContext {
  const args = normalizeTlonCommandArgs(shellSplitCommand(command)).args;
  const discovery = args[0];
  if (
    args.length <= 1 &&
    (!discovery || ['--help', '-h', '--version', '-v'].includes(discovery))
  ) {
    return summarizeKnownTlonCommand(
      [discovery === '--version' || discovery === '-v' ? 'version' : 'help'],
      false
    );
  }
  const subIdx = findTlonSubcommandIndex(args);
  const subcommand = args[subIdx]?.toLowerCase() ?? UNKNOWN_SUBCOMMAND;
  const commandArgs = subIdx >= 0 ? args.slice(subIdx) : [];
  const blockedSendOperation =
    commandArgs.length > 0 && checkBlockedSendOperation(commandArgs) !== null;

  if (!ALLOWED_TLON_COMMANDS.has(subcommand)) {
    return {
      kind: 'tlonCommand',
      summaryKey: `${UNKNOWN_SUBCOMMAND}.${INVALID_OPERATION}`,
      subcommand: UNKNOWN_SUBCOMMAND,
      operation: INVALID_OPERATION,
      intent: 'utility',
      isKnownSubcommand: false,
      blockedSendOperation,
    };
  }

  return summarizeKnownTlonCommand(commandArgs, blockedSendOperation);
}
function summarizeKnownTlonCommand(
  commandArgs: string[],
  blockedSendOperation: boolean
): TlonToolCallContext {
  const subcommand = commandArgs[0]?.toLowerCase() ?? UNKNOWN_SUBCOMMAND;
  const validOperations = ACTION_OPERATIONS_BY_SUBCOMMAND.get(subcommand);
  const hasAction = validOperations != null;
  const operation = hasAction
    ? normalizeActionOperation(commandArgs[1], validOperations)
    : defaultOperationForSubcommand(subcommand);
  const remainder = commandArgs.slice(hasAction ? 2 : 1);

  const build = (
    intent: TlonToolIntent,
    extra: Omit<
      Partial<TlonToolCallContext>,
      | 'kind'
      | 'summaryKey'
      | 'subcommand'
      | 'operation'
      | 'intent'
      | 'isKnownSubcommand'
      | 'blockedSendOperation'
    > = {}
  ): TlonToolCallContext => ({
    kind: 'tlonCommand',
    summaryKey: `${subcommand}.${operation}`,
    subcommand,
    operation,
    intent,
    isKnownSubcommand: true,
    blockedSendOperation,
    ...extra,
  });

  if (operation === INVALID_OPERATION) {
    return build('utility');
  }

  switch (subcommand) {
    case 'activity':
      // mute/unmute/volume change only the acting ship's own preferences.
      return build(
        operation === 'mute' || operation === 'unmute' || operation === 'volume'
          ? 'write'
          : 'read'
      );
    case 'browser':
      return build('write');
    case 'buckets':
      return summarizeBucketsOperation(operation, remainder, build);
    case 'channels':
      return summarizeChannelsOperation(operation, remainder, build);
    case 'contacts':
      return summarizeContactsOperation(operation, remainder, build);
    case 'groups':
      return summarizeGroupsOperation(operation, remainder, build);
    case 'hooks':
      return summarizeHooksOperation(operation, remainder, build);
    case 'messages':
      return summarizeMessagesOperation(operation, remainder, build);
    case 'notes':
      return summarizeNotesOperation(operation, remainder, build);
    case 'dms':
      return summarizeDmsOperation(operation, remainder, build);
    case 'expose':
      return summarizeExposeOperation(operation, remainder, build);
    case 'posts':
      return summarizePostsOperation(operation, remainder, build);
    case 'notebook':
      return build('write', {
        hasContent: hasFlag(remainder, '--content'),
        hasImage: hasFlag(remainder, '--image'),
      });
    case 'upload':
      return build('write', {
        uploadSource: detectUploadSource(remainder),
        contentTypeProvided: hasFlag(remainder, '-t', '--type'),
      });
    case 'settings':
      return build(operation === 'get' ? 'read' : 'config');
    case 'help':
    case 'version':
      return build('utility');
    default:
      return build('utility');
  }
}

function summarizeBucketsOperation(
  operation: string,
  args: string[],
  build: (
    intent: TlonToolIntent,
    extra?: Omit<
      Partial<TlonToolCallContext>,
      | 'kind'
      | 'summaryKey'
      | 'subcommand'
      | 'operation'
      | 'intent'
      | 'isKnownSubcommand'
      | 'blockedSendOperation'
    >
  ) => TlonToolCallContext
): TlonToolCallContext {
  switch (operation) {
    case 'list':
    case 'show':
    case 'files':
    case 'search':
    case 'read':
      return build('read', { channelKind: 'buckets' });
    case 'delete':
    case 'set-writers':
      return build('admin', { channelKind: 'buckets' });
    case 'create':
    case 'mkdir':
    case 'rename':
    case 'move':
      return build('write', {
        channelKind: 'buckets',
        hasTitle: operation === 'create' || operation === 'rename',
      });
    case 'upload':
      return build('write', {
        channelKind: 'buckets',
        uploadSource: detectUploadSource(args.slice(1)),
        contentTypeProvided: hasFlag(args, '-t', '--type'),
      });
    default:
      return build('utility');
  }
}

function normalizeActionOperation(
  rawOperation: string | undefined,
  validOperations: ReadonlySet<string>
): string {
  const operation = rawOperation?.toLowerCase();
  if (!operation) {
    return INVALID_OPERATION;
  }
  return validOperations.has(operation) ? operation : INVALID_OPERATION;
}

function summarizeChannelsOperation(
  operation: string,
  args: string[],
  build: (
    intent: TlonToolIntent,
    extra?: Omit<
      Partial<TlonToolCallContext>,
      | 'kind'
      | 'summaryKey'
      | 'subcommand'
      | 'operation'
      | 'intent'
      | 'isKnownSubcommand'
      | 'blockedSendOperation'
    >
  ) => TlonToolCallContext
): TlonToolCallContext {
  const positionals = collectPositionals(args);
  switch (operation) {
    case 'create': {
      const kind = getOptionValue(args, ['--kind']);
      const createPositionals = collectPositionals(
        args,
        new Set(['--kind', '--description'])
      );
      return build('write', {
        channelKind: kind == null ? 'chat' : parseChannelKind(kind),
        hasTitle: createPositionals.length > 1,
        hasDescription: hasFlag(args, '--description'),
      });
    }
    case 'update':
      return build('write', {
        channelKind: detectChannelKind(positionals[0]),
        hasTitle: hasFlag(args, '--title'),
      });
    case 'rename':
      return build('write', {
        channelKind: detectChannelKind(positionals[0]),
        hasTitle: positionals.length > 1,
      });
    case 'delete':
      return build('admin', {
        channelKind: detectChannelKind(positionals[0]),
      });
    case 'join':
    case 'leave':
      return build('write', {
        channelKind: detectChannelKind(positionals[0]),
      });
    case 'add-writers':
    case 'del-writers':
      return build('admin', {
        channelKind: detectChannelKind(positionals[0]),
        roleCount: Math.max(0, positionals.length - 1),
      });
    case 'add-readers':
    case 'del-readers':
      return build('admin', {
        channelKind: detectChannelKind(positionals[1]),
        roleCount: Math.max(0, positionals.length - 2),
      });
    default:
      return build('read', {
        channelKind: detectChannelKind(positionals[0]),
      });
  }
}

function summarizeContactsOperation(
  operation: string,
  args: string[],
  build: (
    intent: TlonToolIntent,
    extra?: Omit<
      Partial<TlonToolCallContext>,
      | 'kind'
      | 'summaryKey'
      | 'subcommand'
      | 'operation'
      | 'intent'
      | 'isKnownSubcommand'
      | 'blockedSendOperation'
    >
  ) => TlonToolCallContext
): TlonToolCallContext {
  const positionals = collectPositionals(
    args,
    new Set(['--nickname', '--avatar'])
  );
  switch (operation) {
    case 'update-profile':
      return build('write', {
        updateFields: PROFILE_UPDATE_FIELDS.filter(({ flag }) =>
          hasFlag(args, flag)
        ).map(({ field }) => field),
      });
    case 'add':
    case 'remove':
    case 'del':
      return build('write', {
        contactCount: positionals.length,
      });
    case 'update':
      return build('write', {
        contactCount: positionals.length > 0 ? 1 : 0,
        updateFields: PROFILE_UPDATE_FIELDS.filter(
          ({ field, flag }) =>
            (field === 'nickname' || field === 'avatar') && hasFlag(args, flag)
        ).map(({ field }) => field),
      });
    case 'sync':
      // Pokes %contacts to meet the ships it is given.
      return build('write', {
        contactCount: positionals.length,
      });
    default:
      return build('read');
  }
}

function summarizeGroupsOperation(
  operation: string,
  args: string[],
  build: (
    intent: TlonToolIntent,
    extra?: Omit<
      Partial<TlonToolCallContext>,
      | 'kind'
      | 'summaryKey'
      | 'subcommand'
      | 'operation'
      | 'intent'
      | 'isKnownSubcommand'
      | 'blockedSendOperation'
    >
  ) => TlonToolCallContext
): TlonToolCallContext {
  const positionals = collectPositionals(
    args,
    new Set(['--description', '--title', '--kind'])
  );
  switch (operation) {
    case 'create':
    case 'create-owned':
      return build('write', {
        hasDescription: hasFlag(args, '--description'),
      });
    case 'join':
    case 'leave':
      return build('write');
    case 'delete':
      return build('admin');
    case 'update':
      return build('admin', {
        hasTitle: hasFlag(args, '--title'),
        hasDescription: hasFlag(args, '--description'),
      });
    case 'invite':
      return build('admin', {
        inviteeCount: Math.max(0, positionals.length - 1),
      });
    case 'kick':
    case 'ban':
    case 'unban':
    case 'accept-join':
    case 'reject-join':
    case 'promote':
    case 'demote':
      return build('admin', {
        memberCount: Math.max(0, positionals.length - 1),
      });
    case 'set-privacy':
      return build('admin', {
        privacySetting: parsePrivacySetting(positionals[1]),
      });
    case 'add-role':
    case 'delete-role':
    case 'update-role':
      return build('admin', {
        hasTitle: hasFlag(args, '--title'),
      });
    case 'assign-role':
    case 'remove-role':
      return build('admin', {
        memberCount: Math.max(0, positionals.length - 2),
      });
    case 'add-channel': {
      const kind = getOptionValue(args, ['--kind']);
      return build('admin', {
        channelKind: kind == null ? 'chat' : parseChannelKind(kind),
      });
    }
    default:
      return build(
        operation === 'list' || operation === 'info' ? 'read' : 'admin'
      );
  }
}

function summarizeHooksOperation(
  operation: string,
  args: string[],
  build: (
    intent: TlonToolIntent,
    extra?: Omit<
      Partial<TlonToolCallContext>,
      | 'kind'
      | 'summaryKey'
      | 'subcommand'
      | 'operation'
      | 'intent'
      | 'isKnownSubcommand'
      | 'blockedSendOperation'
    >
  ) => TlonToolCallContext
): TlonToolCallContext {
  const positionals = collectPositionals(
    args,
    new Set(['--type', '--name', '--src', '--nest'])
  );
  switch (operation) {
    case 'list':
    case 'get':
      return build('read');
    case 'init':
      // Writes a local hook template; nothing reaches a ship.
      return build('utility');
    case 'edit':
      return build('admin', {
        hasNameChange: hasFlag(args, '--name'),
        hasSourceChange: hasFlag(args, '--src'),
      });
    case 'order':
      return build('admin', {
        hookCount: Math.max(0, positionals.length - 1),
        channelKind: detectChannelKind(positionals[0]),
      });
    case 'cron':
      return build('config', {
        hasNest: hasFlag(args, '--nest'),
      });
    default:
      return build('admin');
  }
}

function summarizeMessagesOperation(
  operation: string,
  args: string[],
  build: (
    intent: TlonToolIntent,
    extra?: Omit<
      Partial<TlonToolCallContext>,
      | 'kind'
      | 'summaryKey'
      | 'subcommand'
      | 'operation'
      | 'intent'
      | 'isKnownSubcommand'
      | 'blockedSendOperation'
    >
  ) => TlonToolCallContext
): TlonToolCallContext {
  const positionals = collectPositionals(
    args,
    new Set(['--limit', '--channel', '--author']),
    new Set(['--resolve-cites'])
  );
  const baseExtra = {
    limit: getNumericOption(args, ['--limit']),
    resolveCites: hasFlag(args, '--resolve-cites'),
  };
  switch (operation) {
    case 'dm':
      return build('read', {
        ...baseExtra,
        dmTargetKind: detectDmTargetKind(positionals[0]),
      });
    case 'channel':
    case 'history':
    case 'context':
    case 'post':
      return build('read', {
        ...baseExtra,
        channelKind: detectChannelKind(positionals[0]),
      });
    case 'search':
      return build('read', {
        ...baseExtra,
        scopedToChannel: hasFlag(args, '--channel'),
        channelKind: detectChannelKind(getOptionValue(args, ['--channel'])),
      });
    default:
      return build('read', baseExtra);
  }
}

function summarizeNotesOperation(
  operation: string,
  args: string[],
  build: (
    intent: TlonToolIntent,
    extra?: Omit<
      Partial<TlonToolCallContext>,
      | 'kind'
      | 'summaryKey'
      | 'subcommand'
      | 'operation'
      | 'intent'
      | 'isKnownSubcommand'
      | 'blockedSendOperation'
    >
  ) => TlonToolCallContext
): TlonToolCallContext {
  const hasBodySource =
    hasFlag(args, '--body', '--markdown') || hasFlag(args, '--stdin');
  switch (operation) {
    case 'status':
    case 'request':
    case 'list':
    case 'show':
    case 'notes':
    case 'note':
    case 'history':
    case 'folders':
    case 'folder':
    case 'members':
    case 'migrate-plan':
      return build('read');
    case 'note-delete':
    case 'note-publish':
    case 'note-unpublish':
    case 'folder-delete':
    case 'notebook-delete':
      return build('admin');
    case 'migrate-apply':
      return build('write');
    case 'create':
    case 'note-create':
    case 'note-update':
    case 'note-rename':
    case 'note-move':
    case 'folder-create':
    case 'folder-rename':
    case 'folder-move':
    case 'join':
    case 'leave':
      return build('write', {
        hasTitle:
          operation === 'create' ||
          operation === 'note-create' ||
          operation === 'note-rename' ||
          operation === 'folder-create' ||
          operation === 'folder-rename',
        hasContent: hasBodySource,
      });
    default:
      return build('utility');
  }
}

function summarizeDmsOperation(
  operation: string,
  args: string[],
  build: (
    intent: TlonToolIntent,
    extra?: Omit<
      Partial<TlonToolCallContext>,
      | 'kind'
      | 'summaryKey'
      | 'subcommand'
      | 'operation'
      | 'intent'
      | 'isKnownSubcommand'
      | 'blockedSendOperation'
    >
  ) => TlonToolCallContext
): TlonToolCallContext {
  const positionals = collectPositionals(args);
  return build(
    operation === 'accept' || operation === 'decline' ? 'admin' : 'write',
    {
      dmTargetKind: detectDmTargetKind(positionals[0]),
    }
  );
}

function summarizeExposeOperation(
  operation: string,
  args: string[],
  build: (
    intent: TlonToolIntent,
    extra?: Omit<
      Partial<TlonToolCallContext>,
      | 'kind'
      | 'summaryKey'
      | 'subcommand'
      | 'operation'
      | 'intent'
      | 'isKnownSubcommand'
      | 'blockedSendOperation'
    >
  ) => TlonToolCallContext
): TlonToolCallContext {
  const positionals = collectPositionals(args);
  const intent =
    operation === 'show' || operation === 'hide' ? 'admin' : 'read';
  return build(intent, {
    channelKind: detectChannelKind(positionals[0]),
  });
}

function summarizePostsOperation(
  operation: string,
  args: string[],
  build: (
    intent: TlonToolIntent,
    extra?: Omit<
      Partial<TlonToolCallContext>,
      | 'kind'
      | 'summaryKey'
      | 'subcommand'
      | 'operation'
      | 'intent'
      | 'isKnownSubcommand'
      | 'blockedSendOperation'
    >
  ) => TlonToolCallContext
): TlonToolCallContext {
  const positionals = collectPositionals(
    args,
    new Set(['--title', '--image', '--content'])
  );
  // A forward acts in its target, the third positional.
  const channelKind = detectChannelKind(
    positionals[operation === 'forward' ? 2 : 0]
  );
  switch (operation) {
    case 'edit':
      return build('write', {
        channelKind,
        hasTitle: hasFlag(args, '--title'),
        hasImage: hasFlag(args, '--image'),
        hasContent: hasFlag(args, '--content'),
      });
    case 'pin':
    case 'unpin':
      return build('admin', { channelKind });
    default:
      return build('write', { channelKind });
  }
}

function defaultOperationForSubcommand(subcommand: string): string {
  switch (subcommand) {
    case 'upload':
      return 'upload';
    case 'notebook':
      return 'publish';
    case 'help':
    case 'version':
      return 'show';
    case 'settings':
      return 'get';
    default:
      return 'list';
  }
}

function collectPositionals(
  args: string[],
  flagsWithValue = new Set<string>(),
  booleanFlags = new Set<string>()
): string[] {
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if ((arg.startsWith('--') || arg.startsWith('-')) && arg.includes('=')) {
      const flag = arg.slice(0, arg.indexOf('='));
      if (flagsWithValue.has(flag) || booleanFlags.has(flag)) {
        continue;
      }
    }

    if (flagsWithValue.has(arg)) {
      i += 1;
      continue;
    }

    if (booleanFlags.has(arg)) {
      continue;
    }

    positionals.push(arg);
  }

  return positionals;
}

function hasFlag(args: string[], ...flags: string[]): boolean {
  return args.some((arg) =>
    flags.some((flag) => arg === flag || arg.startsWith(`${flag}=`))
  );
}

function getOptionValue(args: string[], flags: string[]): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    for (const flag of flags) {
      if (arg === flag) {
        return args[i + 1];
      }
      if (arg.startsWith(`${flag}=`)) {
        return arg.slice(flag.length + 1);
      }
    }
  }
  return undefined;
}

function getNumericOption(args: string[], flags: string[]): number | undefined {
  const value = getOptionValue(args, flags);
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function detectChannelKind(
  value: string | undefined
): TlonChannelKind | undefined {
  return parseChannelKind(value);
}

function parseChannelKind(
  value: string | undefined
): TlonChannelKind | undefined {
  if (!value) {
    return undefined;
  }
  const parts = value.split('/');
  const kind =
    parts[0] === '' && parts[1] === '1' && parts[2] === 'chan'
      ? parts[3]
      : parts[0];
  return kind === 'buckets' ||
    kind === 'chat' ||
    kind === 'heap' ||
    kind === 'notes'
    ? kind
    : undefined;
}

function detectDmTargetKind(value: string | undefined): TlonDmTargetKind {
  if (!value) {
    return 'unknown';
  }
  if (value.startsWith('0v')) {
    return 'club';
  }
  if (value.startsWith('~')) {
    return 'ship';
  }
  return 'unknown';
}

function detectUploadSource(args: string[]): TlonUploadSource {
  if (hasFlag(args, '--stdin')) {
    return 'stdin';
  }

  const positionals = collectPositionals(
    args,
    new Set(['-t', '--type']),
    new Set(['--stdin'])
  );
  const source = positionals[0];
  if (!source) {
    return 'unknown';
  }
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return 'url';
  }
  return 'local';
}

function parsePrivacySetting(
  value: string | undefined
): TlonToolCallContext['privacySetting'] | undefined {
  if (value === 'public' || value === 'private' || value === 'secret') {
    return value;
  }
  return undefined;
}
