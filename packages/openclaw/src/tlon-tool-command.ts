import { checkBlockedSendOperation } from './tlon-tool-guard.js';

export const ALLOWED_TLON_COMMANDS = new Set([
  'activity',
  'channels',
  'contacts',
  'dms',
  'expose',
  'groups',
  'hooks',
  'messages',
  'notebook',
  'posts',
  'settings',
  'upload',
  'help',
  'version',
]);

const CREDENTIAL_FLAGS_WITH_VALUE = new Set([
  '--config',
  '--url',
  '--ship',
  '--code',
  '--cookie',
]);

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
export type TlonChannelKind = 'chat' | 'diary' | 'heap';
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
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--') && arg.includes('=')) {
      const flag = arg.slice(0, arg.indexOf('='));
      if (CREDENTIAL_FLAGS_WITH_VALUE.has(flag)) {
        i += 1;
        continue;
      }
    }
    if (CREDENTIAL_FLAGS_WITH_VALUE.has(arg)) {
      i += 2;
      continue;
    }
    return i;
  }
  return -1;
}

export function summarizeTlonCommand(command: string): TlonToolCallContext {
  const args = shellSplitCommand(command);
  const subIdx = findTlonSubcommandIndex(args);
  const subcommand = args[subIdx]?.toLowerCase() ?? 'unknown';
  const commandArgs = subIdx >= 0 ? args.slice(subIdx) : [];
  const blockedSendOperation =
    commandArgs.length > 0 && checkBlockedSendOperation(commandArgs) !== null;

  if (!ALLOWED_TLON_COMMANDS.has(subcommand)) {
    return {
      kind: 'tlonCommand',
      summaryKey: `${subcommand}.invalid`,
      subcommand,
      operation: 'invalid',
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
  const subcommand = commandArgs[0]?.toLowerCase() ?? 'unknown';
  const actionSubcommands = new Set([
    'activity',
    'channels',
    'contacts',
    'groups',
    'hooks',
    'messages',
    'dms',
    'expose',
    'posts',
    'settings',
  ]);
  const hasAction = actionSubcommands.has(subcommand);
  const operation = hasAction
    ? commandArgs[1]?.toLowerCase() ?? defaultOperationForSubcommand(subcommand)
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

  switch (subcommand) {
    case 'activity':
      return build('read');
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
    case 'dms':
      return summarizeDmsOperation(operation, remainder, build);
    case 'expose':
      return summarizeExposeOperation(operation, remainder, build);
    case 'posts':
      return summarizePostsOperation(operation, remainder, build);
    case 'notebook':
      return build('write', {
        channelKind: 'diary',
        hasContent: hasFlag(remainder, '--content'),
        hasImage: hasFlag(remainder, '--image'),
      });
    case 'upload':
      return build('write', {
        uploadSource: detectUploadSource(remainder),
        contentTypeProvided: hasFlag(remainder, '-t', '--type'),
      });
    case 'settings':
      return build('config');
    case 'help':
    case 'version':
      return build('utility');
    default:
      return build('utility');
  }
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
    case 'update':
      return build('write', {
        channelKind: detectChannelKind(positionals[0]),
        hasTitle: hasFlag(args, '--title'),
      });
    case 'delete':
      return build('admin', {
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
  const positionals = collectPositionals(args);
  switch (operation) {
    case 'update-profile':
      return build('write', {
        updateFields: PROFILE_UPDATE_FIELDS.filter(({ flag }) =>
          hasFlag(args, flag)
        ).map(({ field }) => field),
      });
    case 'add':
    case 'remove':
      return build('write', {
        contactCount: positionals.length,
      });
    case 'sync':
      return build('read', {
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
    case 'add-channel':
      return build('admin', {
        channelKind: parseChannelKind(getOptionValue(args, ['--kind'])),
      });
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
  const channelKind = detectChannelKind(positionals[0]);
  switch (operation) {
    case 'edit':
      return build('write', {
        channelKind,
        hasTitle: hasFlag(args, '--title'),
        hasImage: hasFlag(args, '--image'),
        hasContent: hasFlag(args, '--content'),
      });
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
  const kind = value.split('/', 1)[0];
  return kind === 'chat' || kind === 'diary' || kind === 'heap'
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
