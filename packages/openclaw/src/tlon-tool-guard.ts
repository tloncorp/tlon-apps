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
  'browser',
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
