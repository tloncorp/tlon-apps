/**
 * Runtime guard for the tlon tool.
 *
 * Blocks confirmed wrong-path send operations that should use the built-in
 * `message` tool instead. Allows legacy club (0v...) targets for backward
 * compatibility — clubs are deprecated and slated for removal audit.
 */

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

export function isAllowedTlonSubcommand(
  subcommand: string | undefined
): boolean {
  return subcommand != null && ALLOWED_TLON_COMMAND_SET.has(subcommand);
}

export function formatAllowedTlonSubcommands(): string {
  return ALLOWED_TLON_COMMANDS.join(', ');
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
  const action = args[1]?.toLowerCase();

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
