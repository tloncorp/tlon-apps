/**
 * Runtime policy guard for the model-facing tlon tool.
 *
 * Enforces the supported command surface, keeps owner-confirmed diary
 * migrations out of model-issued writes, and redirects send operations that
 * belong on OpenClaw's built-in message path.
 */
import { canonicalizeNest } from './targets.js';

export const ALLOWED_TLON_COMMANDS = [
  'activity',
  'channels',
  'contacts',
  'dms',
  'expose',
  'groups',
  'hooks',
  'messages',
  'notes',
  'notebook',
  'posts',
  'settings',
  'upload',
  'help',
  'version',
] as const;

const ALLOWED_TLON_COMMAND_SET = new Set<string>(ALLOWED_TLON_COMMANDS);
const DIARY_CHANNEL_TARGET_ACTIONS = new Set(['info', 'delete', 'update']);
const CHANNEL_WRITER_ACTIONS = new Set(['add-writers', 'del-writers']);
const MESSAGES_COMMANDS = new Set([
  'dm',
  'channel',
  'history',
  'search',
  'context',
  'post',
]);
const POSTS_COMMANDS = new Set([
  'send',
  'reply',
  'react',
  'unreact',
  'edit',
  'delete',
]);
const EXPOSE_TARGET_COMMANDS = new Set(['show', 'hide', 'check', 'url']);
const HELP_ARGS = new Set(['--help', '-h']);
const MIGRATION_BOOLEAN_FLAGS = new Set([
  '--allow-write-widening',
  '--force',
  '--yes',
]);
const NO_FLAGS_WITH_VALUES = new Set<string>();
const POST_REPLY_OPTION_FLAGS = ['author', 'blob', 'sent-at'] as const;
const POST_SEND_OPTION_FLAGS = ['blob', 'image', 'title', 'sent-at'] as const;

/**
 * Find the first positional argument after skipping known options.
 *
 * Options with separate values consume the following argument; boolean and
 * equals-style options consume only themselves.
 */
export function findFirstPositionalArgumentIndex(
  args: string[],
  from: number,
  flagsWithValues: ReadonlySet<string>,
  booleanFlags: ReadonlySet<string> = NO_FLAGS_WITH_VALUES
): number {
  let index = from;
  while (index < args.length) {
    const arg = args[index] ?? '';
    const equalsIndex = arg.indexOf('=');
    const flag = equalsIndex >= 0 ? arg.slice(0, equalsIndex) : arg;
    if (flagsWithValues.has(flag)) {
      index += equalsIndex >= 0 ? 1 : 2;
      continue;
    }
    if (booleanFlags.has(flag)) {
      index += 1;
      continue;
    }
    return index;
  }
  return -1;
}

export function isAllowedTlonSubcommand(
  subcommand: string | undefined
): boolean {
  return subcommand != null && ALLOWED_TLON_COMMAND_SET.has(subcommand);
}

export function formatAllowedTlonSubcommands(): string {
  return ALLOWED_TLON_COMMANDS.join(', ');
}

export type DiaryRefusal = {
  message: string;
  nest?: string;
};

function migrationBlockedMessage(nest?: string): string {
  const command = `/migrate ${nest ?? '<diary-nest>'}`;
  return (
    'Blocked: this notes operation requires owner confirmation. ' +
    `Ask the owner to type \`${command}\`.`
  );
}

function migrationCleanupBlockedMessage(nest?: string): string {
  const command = `/migrate cleanup ${nest ?? '<notes-nest>'}`;
  return (
    'Blocked: this notes operation requires owner confirmation. ' +
    `Ask the owner to type \`${command}\`.`
  );
}

function notebookBlockedMessage(nest?: string): string {
  const command = `/migrate ${nest ?? '<diary-nest>'}`;
  return (
    'Blocked: the notebook command uses deprecated %diary behavior ' +
    "that this tool does not support. Use 'tlon notes' for %notes " +
    'notebooks. To migrate a diary, ask the owner to type ' +
    `\`${command}\`.`
  );
}

function diaryTargetBlockedMessage(nest: string): string {
  return (
    'Blocked: %diary channels are deprecated and unsupported by this CLI ' +
    `tool. Ask the owner to type \`/migrate ${nest}\`.`
  );
}

function canonicalDiaryNest(raw: string | undefined): string | null {
  if (!raw) return null;
  return canonicalizeNest(raw, 'diary');
}

function canonicalNotesNest(raw: string | undefined): string | null {
  if (!raw) return null;
  return canonicalizeNest(raw, 'notes');
}

function diaryNestFromCitePath(raw: string | undefined): string | null {
  if (!raw) return null;
  const parts = raw.trim().split('/');
  if (
    parts.length >= 6 &&
    parts[0] === '' &&
    parts[1] === '1' &&
    parts[2] === 'chan'
  ) {
    return canonicalDiaryNest(parts.slice(3, 6).join('/'));
  }
  return canonicalDiaryNest(parts.slice(0, 3).join('/'));
}

function isHelpArg(arg: string | undefined): boolean {
  return arg != null && HELP_ARGS.has(arg);
}

function wantsHelp(args: string[]): boolean {
  return args.some((arg) => isHelpArg(arg));
}

function firstFlagIndex(args: string[], flags: readonly string[]): number {
  const indexes = flags
    .map((flag) => args.indexOf(`--${flag}`))
    .filter((index) => index !== -1);
  return indexes.length > 0 ? Math.min(...indexes) : args.length;
}

function firstPostSendFlagIndex(args: string[]): number {
  const indexes = POST_SEND_OPTION_FLAGS.map((flag) =>
    flag === 'image'
      ? args.findIndex((arg) => arg === '--image' || arg.startsWith('--image='))
      : args.indexOf(`--${flag}`)
  ).filter((index) => index !== -1);
  return indexes.length > 0 ? Math.min(...indexes) : args.length;
}

function messagesHelpTakesPrecedence(args: string[]): boolean {
  const cliArgs = args.slice(1);
  if (isHelpArg(cliArgs[0])) {
    return true;
  }
  if (!wantsHelp(cliArgs.slice(1))) {
    return false;
  }

  const channelIndex = cliArgs.indexOf('--channel', 2);
  const searchChannel =
    channelIndex >= 0 &&
    cliArgs[channelIndex + 1] &&
    !cliArgs[channelIndex + 1]?.startsWith('--');
  const searchQueryHelpLiteral =
    cliArgs[0] === 'search' && isHelpArg(cliArgs[1]) && searchChannel;
  return !searchQueryHelpLiteral;
}

function exposeHelpTakesPrecedence(args: string[]): boolean {
  const cliArgs = args.slice(1);
  return isHelpArg(cliArgs[0]) || wantsHelp(cliArgs.slice(1));
}

function postsHelpTakesPrecedence(args: string[]): boolean {
  const cliArgs = args.slice(1);
  if (isHelpArg(cliArgs[0])) {
    return true;
  }
  if (!wantsHelp(cliArgs.slice(1))) {
    return false;
  }

  const editMessageHelpLiteral =
    cliArgs[0] === 'edit' &&
    !!cliArgs[1] &&
    !!cliArgs[2] &&
    wantsHelp(cliArgs.slice(3));
  const sendMessageHelpLiteral =
    cliArgs[0] === 'send' &&
    !!cliArgs[1] &&
    wantsHelp(cliArgs.slice(2, firstPostSendFlagIndex(cliArgs)));
  const replyMessageHelpLiteral =
    cliArgs[0] === 'reply' &&
    !!cliArgs[1] &&
    !!cliArgs[2] &&
    wantsHelp(
      cliArgs.slice(3, firstFlagIndex(cliArgs, POST_REPLY_OPTION_FLAGS))
    );
  return (
    !editMessageHelpLiteral &&
    !sendMessageHelpLiteral &&
    !replyMessageHelpLiteral
  );
}

function diaryNestForRemovedCliOperation(args: string[]): string | null {
  const subcommand = args[0]?.toLowerCase();
  // The packaged CLI's command maps are case-sensitive. Validate against the
  // same action spellings before inspecting a possible diary target.
  const action = args[1] ?? '';

  if (subcommand === 'channels') {
    if (DIARY_CHANNEL_TARGET_ACTIONS.has(action)) {
      return canonicalDiaryNest(args[2]);
    }
    if (action === 'rename') {
      return args[3] ? canonicalDiaryNest(args[2]) : null;
    }
    if (CHANNEL_WRITER_ACTIONS.has(action)) {
      return args.slice(3).length > 0 ? canonicalDiaryNest(args[2]) : null;
    }
    if (action === 'add-readers' || action === 'del-readers') {
      return args[2] && args.slice(4).length > 0
        ? canonicalDiaryNest(args[3])
        : null;
    }
    return null;
  }

  if (subcommand === 'messages') {
    if (messagesHelpTakesPrecedence(args)) {
      return null;
    }
    if (!MESSAGES_COMMANDS.has(action)) {
      return null;
    }
    if (action === 'channel' || action === 'history') {
      return canonicalDiaryNest(args[2]);
    }
    if (action === 'context' || action === 'post') {
      return args[2] && args[3] ? canonicalDiaryNest(args[2]) : null;
    }
    if (action === 'search') {
      if (!args[2]) return null;
      // messages.ts deliberately begins scanning after the query.
      const channelIndex = args.indexOf('--channel', 3);
      const channel = channelIndex >= 0 ? args[channelIndex + 1] : undefined;
      return canonicalDiaryNest(
        channel && !channel.startsWith('--') ? channel : undefined
      );
    }
    return null;
  }

  if (subcommand === 'posts') {
    if (postsHelpTakesPrecedence(args)) {
      return null;
    }
    if (!POSTS_COMMANDS.has(action)) {
      return null;
    }
    return canonicalDiaryNest(args[2]);
  }

  if (subcommand === 'expose') {
    if (exposeHelpTakesPrecedence(args)) {
      return null;
    }
    if (!EXPOSE_TARGET_COMMANDS.has(action)) {
      return null;
    }
    return diaryNestFromCitePath(args[2]);
  }

  return null;
}

function migrationSourceOperand(args: string[]): string | undefined {
  const index = findFirstPositionalArgumentIndex(
    args,
    2,
    NO_FLAGS_WITH_VALUES,
    MIGRATION_BOOLEAN_FLAGS
  );
  return index >= 0 ? args[index] : undefined;
}

/**
 * Match the model-tool commands whose packaged CLI path locally refuses a
 * diary target. This does not affect OpenClaw's direct `message` delivery,
 * which intentionally continues to support diary channels.
 */
export function checkBlockedDiaryOperation(
  args: string[]
): DiaryRefusal | null {
  const subcommand = args[0]?.toLowerCase();
  if (subcommand === 'notebook') {
    const nest = canonicalDiaryNest(args[1]) ?? undefined;
    return { message: notebookBlockedMessage(nest), nest };
  }

  const nest = diaryNestForRemovedCliOperation(args);
  return nest ? { message: diaryTargetBlockedMessage(nest), nest } : null;
}

/**
 * Keep model-issued migration writes behind the authenticated owner command.
 *
 * This guard is intentionally duplicated in each runtime because the skill
 * package does not publish its source files. The model-tool boundary must carry
 * the guard locally.
 */
export function checkBlockedMigrationOperation(args: string[]): string | null {
  const command = args[0]?.toLowerCase();
  const subcommand = args[1]?.toLowerCase();
  if (!subcommand) return null;
  if (command === 'channels' && subcommand === 'delete') {
    const nest = canonicalNotesNest(migrationSourceOperand(args));
    return nest ? migrationCleanupBlockedMessage(nest) : null;
  }
  if (command !== 'notes') return null;
  if (subcommand === 'notebook-delete') {
    const nest = canonicalNotesNest(migrationSourceOperand(args)) ?? undefined;
    return migrationCleanupBlockedMessage(nest);
  }
  if (!subcommand.startsWith('migrate')) return null;
  const nest = canonicalDiaryNest(migrationSourceOperand(args)) ?? undefined;
  return subcommand === 'migrate-plan' ? null : migrationBlockedMessage(nest);
}

/**
 * Keep app-invisible standalone notebooks out of model-issued writes.
 *
 * The CLI remains available to an operator who deliberately needs a raw
 * `%notes` notebook. Tlonbot should keep output in the requesting conversation
 * unless the owner explicitly chooses a reachable Notebook channel.
 */
export function checkBlockedStandaloneNotebookCreation(
  args: string[]
): string | null {
  const command = args[0]?.toLowerCase();
  const subcommand = args[1]?.toLowerCase();
  if (command !== 'notes' || subcommand !== 'create') return null;

  // Let the packaged CLI answer help and malformed invocations. Only block an
  // actual create attempt with a title.
  if (args.slice(2).some((arg) => HELP_ARGS.has(arg)) || !args[2]) return null;

  return (
    'Blocked: `notes create` makes a standalone backend notebook that is not ' +
    'listed in Tlon Messenger. Send replies, alerts, and status updates to ' +
    'the requesting conversation unless the owner chose another destination. ' +
    'If the owner explicitly asked to save durable reference material, use ' +
    '`channels groups` to find the named Notebook or the existing `Updates` ' +
    'Notebook in the relevant Tlonbot group. Prefer the current group; from ' +
    'a DM, confirm the destination when more than one owner-visible Notebook ' +
    'could fit. Then use `channels groups` to verify the Notebook is registered ' +
    'and its reader roles include the owner (group membership alone is not ' +
    'enough). Create a new group-backed Notebook with ' +
    '`channels create ~host/group-slug "Title" --kind notes` only when the ' +
    'owner explicitly asks for a new Notebook. Never silently choose an ' +
    'ambiguous group.'
  );
}

const NOTE_PATH_READ_OPERATIONS = new Set([
  'show',
  'notes',
  'note',
  'folders',
  'folder',
  'history',
  'members',
]);
const NOTEBOOK_CONTENT_WRITE_OPERATIONS = new Set([
  'note-create',
  'note-update',
  'note-rename',
  'note-move',
  'note-delete',
  'folder-create',
  'folder-rename',
  'folder-move',
  'folder-delete',
]);

export function modelNotebookContentWriteTarget(args: string[]): string | null {
  if (args[0]?.toLowerCase() !== 'notes' || wantsHelp(args.slice(1))) {
    return null;
  }
  if (!NOTEBOOK_CONTENT_WRITE_OPERATIONS.has(args[1]?.toLowerCase() ?? '')) {
    return null;
  }
  return canonicalNotesNest(args[2]);
}

function normalizeShipForComparison(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith('~') ? trimmed : `~${trimmed}`;
}

function roleIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const roles: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      roles.push(entry);
    } else if (
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { roleId?: unknown }).roleId === 'string'
    ) {
      roles.push((entry as { roleId: string }).roleId);
    } else {
      return null;
    }
  }
  return roles;
}

function groupForNotebook(
  groups: unknown[],
  nest: string
): Record<string, unknown> | null {
  for (const rawGroup of groups) {
    if (!rawGroup || typeof rawGroup !== 'object') continue;
    const group = rawGroup as { channels?: unknown };
    if (!Array.isArray(group.channels)) continue;
    const registered = group.channels.some(
      (candidate) =>
        candidate &&
        typeof candidate === 'object' &&
        ((candidate as { nest?: unknown }).nest === nest ||
          (candidate as { id?: unknown }).id === nest)
    );
    if (registered) return rawGroup as Record<string, unknown>;
  }
  return null;
}

export function notebookWriteRegistrationGroup(
  groupsJson: string,
  nest: string
): string | null {
  try {
    const parsed = JSON.parse(groupsJson);
    if (!Array.isArray(parsed)) return null;
    const group = groupForNotebook(parsed, nest);
    return typeof group?.id === 'string' ? group.id : null;
  } catch {
    return null;
  }
}

function ownerRolesFromGroupInfo(
  groupInfo: string | undefined,
  owner: string
): string[] | null {
  if (!groupInfo) return null;
  const membersHeader = groupInfo.match(/^--- Members ---\s*$/im);
  if (membersHeader?.index == null) return null;
  const afterHeader = groupInfo.slice(
    membersHeader.index + membersHeader[0].length
  );
  const nextSection = afterHeader.search(/^--- .+ ---\s*$/m);
  const membersSection =
    nextSection === -1 ? afterHeader : afterHeader.slice(0, nextSection);
  const escapedOwner = owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const memberLine = membersSection
    .split(/\r?\n/)
    .find((line) =>
      new RegExp(`^\\s*${escapedOwner}(?:\\s|$)`, 'i').test(line)
    );
  if (!memberLine) return null;
  const roles = memberLine.match(/\[([^\]]*)\]\s*$/);
  return roles?.[1]
    ? roles[1]
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean)
    : [];
}

function readersFromChannelInfo(
  channelInfo: string | undefined
): string[] | null {
  const match = channelInfo?.match(/^Readers:\s*(.+?)\s*$/im);
  if (!match) return null;
  if (match[1].toLowerCase() === '(all members)') return [];
  return match[1]
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
}

/**
 * Validate a model-selected destination against the fresh `channels groups`
 * response. Registration alone is insufficient: the configured owner must be
 * a joined member (or host), and restricted channels must include one of the
 * owner's roles. Missing or malformed permission data fails closed.
 */
export function notebookWriteDestinationError(
  groupsJson: string,
  nest: string,
  ownerShip: string | null | undefined,
  evidence?: { groupInfo?: string; channelInfo?: string }
): string | null {
  if (!ownerShip) {
    return (
      `Blocked: cannot write to ${nest} because no owner ship is configured ` +
      'for visibility verification.'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(groupsJson);
  } catch {
    return (
      `Blocked: cannot write to ${nest} because the current group/channel ` +
      'listing could not be parsed for visibility verification.'
    );
  }
  if (!Array.isArray(parsed)) {
    return (
      `Blocked: cannot write to ${nest} because the current group/channel ` +
      'listing is malformed.'
    );
  }

  const owner = normalizeShipForComparison(ownerShip);
  const group = groupForNotebook(parsed, nest) as {
    id?: unknown;
    channels?: unknown;
    members?: unknown;
  } | null;
  if (!group) {
    return `Blocked: ${nest} is a standalone or stale backend notebook, not a currently registered Notebook channel. Choose a Notebook from \`channels groups\` first.`;
  }

  const groupId = typeof group.id === 'string' ? group.id : '';
  const host = groupId.split('/')[0];
  const ownerIsHost = !!host && normalizeShipForComparison(host) === owner;
  if (ownerIsHost) return null;

  const channels = Array.isArray(group.channels) ? group.channels : [];
  const channel = channels.find(
    (candidate) =>
      candidate &&
      typeof candidate === 'object' &&
      ((candidate as { nest?: unknown }).nest === nest ||
        (candidate as { id?: unknown }).id === nest)
  ) as { readerRoles?: unknown } | undefined;
  const members = Array.isArray(group.members) ? group.members : [];
  const ownerMember = members.find((candidate) => {
    if (!candidate || typeof candidate !== 'object') return false;
    const member = candidate as { contactId?: unknown; status?: unknown };
    return (
      typeof member.contactId === 'string' &&
      normalizeShipForComparison(member.contactId) === owner &&
      (member.status == null || member.status === 'joined')
    );
  }) as { roles?: unknown } | undefined;

  const ownerRoles = ownerMember
    ? roleIds(ownerMember.roles)
    : ownerRolesFromGroupInfo(evidence?.groupInfo, owner);
  const readers =
    roleIds(channel?.readerRoles) ??
    readersFromChannelInfo(evidence?.channelInfo);
  if (ownerRoles && readers) {
    if (ownerRoles.includes('admin') || readers.length === 0) return null;
    if (readers.some((readerRole) => ownerRoles.includes(readerRole))) {
      return null;
    }
  }

  return `Blocked: ${nest} is registered as a Notebook channel, but the configured owner ${owner} could not be verified as a reader. Choose an owner-visible Notebook or fix its reader roles first.`;
}

/**
 * Add navigation semantics to model-facing reads of a `%notes` path. A nest is
 * a backend identifier whether or not the notebook is registered in a group;
 * it must never be presented as a route to a global app screen.
 */
export function notebookNavigationNotice(args: string[]): string | null {
  if (args[0]?.toLowerCase() !== 'notes') return null;
  const operation = args[1]?.toLowerCase() ?? '';
  if (operation === 'list') {
    return (
      'Navigation: `%notes` lists backend notebooks, including standalone ' +
      'notebooks that have no Tlon Messenger screen. A notebook is app-visible ' +
      'only when its nest is registered as a Notebook channel inside a group; ' +
      'verify with `channels info <notes-nest>`.'
    );
  }
  if (!NOTE_PATH_READ_OPERATIONS.has(operation)) {
    return null;
  }
  if (!canonicalizeNest(args[2], 'notes')) return null;

  return (
    'Navigation: a `notes/~host/name` nest is a backend identifier, not a ' +
    'Tlon Messenger route, and it does not imply a global Notes or Notebooks ' +
    'screen. An owner can open it in the app only when it is registered as a ' +
    'Notebook channel inside a group; verify with `channels info <notes-nest>`. ' +
    'Otherwise offer to copy or paste the content into a group channel or chat ' +
    'the owner can reach.'
  );
}

export function refusedDiaryNest(args: string[]): string | null {
  const migration = checkBlockedMigrationOperation(args);
  if (migration) {
    return canonicalDiaryNest(migrationSourceOperand(args));
  }
  return checkBlockedDiaryOperation(args)?.nest ?? null;
}

/** DM sub-operations that are send actions (not management). */
const DM_SEND_ACTIONS = new Set(['send', 'reply']);

/**
 * Check whether a parsed tlon command is a blocked send operation.
 *
 * Returns a redirect message string if the operation is blocked,
 * or null if the operation is allowed.
 */
export function checkBlockedSendOperation(args: string[]): string | null {
  if (args.length < 2) return null;

  const subcommand = args[0]?.toLowerCase();
  const action = args[1] ?? '';

  if (subcommand !== 'dms' || !DM_SEND_ACTIONS.has(action)) {
    return null;
  }

  // dms send/reply require a target as the next argument
  const target = args[2];
  if (!target) return null;

  // Allow legacy club targets (0v...) for backward compatibility
  if (target.startsWith('0v')) {
    return null;
  }

  // Non-club target — this is a wrong-path send that should use `message`
  // For replies, preserve the messageId (args[3]) so the redirect includes replyTo
  if (action === 'reply') {
    const messageId = args[3] ?? '<messageId>';
    return (
      `Blocked: 'dms reply' with a ship target should use the \`message\` tool instead. ` +
      `Use: message action=send, channel=tlon, target=${target}, replyTo=${messageId}, message=<text>. ` +
      `The \`message\` tool handles threading, bot profile, rate limiting, and reply routing correctly.`
    );
  }

  return (
    `Blocked: 'dms send' with a ship target should use the \`message\` tool instead. ` +
    `Use: message action=send, channel=tlon, target=${target}, message=<text>. ` +
    `The \`message\` tool handles threading, bot profile, rate limiting, and reply routing correctly.`
  );
}
