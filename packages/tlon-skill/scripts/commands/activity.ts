import type {
  getGroupAndChannelUnreads,
  getInitialActivity,
} from '@tloncorp/api';

import {
  type CommandDeps,
  handleExpectedCommandError,
  isHelpArg,
  usageError,
  writeHelp,
  writeLine,
} from './command';

export type ActivityInit = Awaited<
  ReturnType<typeof getGroupAndChannelUnreads>
>;
export type ActivityEvent = Awaited<
  ReturnType<typeof getInitialActivity>
>['events'][number];
export type BaseUnread = NonNullable<ActivityInit['baseUnread']>;
export type GroupUnread = ActivityInit['groupUnreads'][number];
export type ChannelUnread = ActivityInit['channelUnreads'][number];

export interface ActivityApi {
  getInitialActivity: () => Promise<{ events: ActivityEvent[] }>;
  getGroupAndChannelUnreads: () => Promise<ActivityInit>;
}

export interface ActivityFormatter {
  activityHeader: (bucket: ActivityBucket, count: number) => string;
  noActivity: (bucket: ActivityBucket) => string;
  event: (event: ActivityEvent) => string;
  unreadsHeader: () => string;
  noUnreads: () => string;
  baseUnread: (summary: BaseUnread) => string;
  groupUnread: (summary: GroupUnread) => string;
  channelUnread: (summary: ChannelUnread) => string;
}

export interface ActivityDeps extends CommandDeps {
  authenticate: () => Promise<void>;
  activityApi: ActivityApi;
  format: ActivityFormatter;
}

export const ACTIVITY_HELP = `Usage: tlon activity <command>

Commands:
  mentions [--limit N]   Show mention activity
  replies [--limit N]    Show reply activity
  all [--limit N]        Show all activity
  unreads                Show unread counts`;

const ACTIVITY_BUCKET_COMMANDS = ['mentions', 'replies', 'all'] as const;
type ActivityBucketCommand = (typeof ACTIVITY_BUCKET_COMMANDS)[number];
export type ActivityBucket = ActivityBucketCommand;
type ActivityCommand = ActivityBucketCommand | 'unreads';

const ACTIVITY_COMMANDS = new Set<string>([
  ...ACTIVITY_BUCKET_COMMANDS,
  'unreads',
]);

type ParsedActivityArgs =
  | { kind: 'help' }
  | { kind: 'activity'; command: ActivityBucketCommand; limit: number }
  | { kind: 'unreads' };

function isActivityBucketCommand(
  command: string
): command is ActivityBucketCommand {
  return (ACTIVITY_BUCKET_COMMANDS as readonly string[]).includes(command);
}

function isActivityCommand(command: string): command is ActivityCommand {
  return ACTIVITY_COMMANDS.has(command);
}

function parsePositiveInteger(raw: string): number | null {
  if (!/^[0-9]+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseArgs(args: string[]): ParsedActivityArgs {
  const command = args[0];

  if (isHelpArg(command)) {
    return { kind: 'help' };
  }

  if (!command) {
    throw usageError(ACTIVITY_HELP);
  }

  if (!isActivityCommand(command)) {
    throw usageError(`Unknown activity command: ${command}`, ACTIVITY_HELP);
  }

  let limit = 10;
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];

    if (isHelpArg(arg)) {
      return { kind: 'help' };
    }

    if (arg === '--limit') {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        throw usageError('--limit requires a value', ACTIVITY_HELP);
      }
      const parsed = parsePositiveInteger(value);
      if (parsed === null) {
        throw usageError('--limit must be a positive integer', ACTIVITY_HELP);
      }
      limit = parsed;
      i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw usageError(`Unknown option: ${arg}`, ACTIVITY_HELP);
    }

    throw usageError(`Unknown argument: ${arg}`, ACTIVITY_HELP);
  }

  if (isActivityBucketCommand(command)) {
    return { kind: 'activity', command, limit };
  }

  return { kind: 'unreads' };
}

function hasUnread(summary: BaseUnread | GroupUnread | ChannelUnread): boolean {
  return (summary.count ?? 0) > 0 || !!summary.notify;
}

async function showActivity(
  bucket: ActivityBucket,
  limit: number,
  deps: ActivityDeps
): Promise<void> {
  const { events } = await deps.activityApi.getInitialActivity();
  const bucketEvents = events
    .filter((event) => event.bucketId === bucket)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  if (bucketEvents.length === 0) {
    writeLine(deps.stdout, deps.format.noActivity(bucket));
    return;
  }

  writeLine(
    deps.stdout,
    deps.format.activityHeader(bucket, bucketEvents.length)
  );

  for (const event of bucketEvents) {
    const formatted = deps.format.event(event);
    if (formatted) {
      writeLine(deps.stdout, formatted);
      writeLine(deps.stdout);
    }
  }
}

async function showUnreads(deps: ActivityDeps): Promise<void> {
  const activity = await deps.activityApi.getGroupAndChannelUnreads();

  writeLine(deps.stdout, deps.format.unreadsHeader());

  const groupEntries = activity.groupUnreads.filter(hasUnread);
  const channelEntries = activity.channelUnreads.filter(hasUnread);

  if (groupEntries.length === 0 && channelEntries.length === 0) {
    writeLine(deps.stdout, deps.format.noUnreads());
    return;
  }

  if (activity.baseUnread) {
    writeLine(deps.stdout, deps.format.baseUnread(activity.baseUnread));
    writeLine(deps.stdout);
  }

  for (const summary of groupEntries) {
    writeLine(deps.stdout, deps.format.groupUnread(summary));
    writeLine(deps.stdout);
  }

  for (const summary of channelEntries) {
    writeLine(deps.stdout, deps.format.channelUnread(summary));
    writeLine(deps.stdout);
  }
}

export async function run(args: string[], deps: ActivityDeps): Promise<number> {
  try {
    const parsed = parseArgs(args);
    if (parsed.kind === 'help') {
      return writeHelp(deps, ACTIVITY_HELP);
    }

    await deps.authenticate();

    if (parsed.kind === 'unreads') {
      await showUnreads(deps);
    } else {
      await showActivity(parsed.command, parsed.limit, deps);
    }

    return 0;
  } catch (error) {
    const handled = handleExpectedCommandError(error, deps);
    if (handled !== null) return handled;
    throw error;
  }
}
