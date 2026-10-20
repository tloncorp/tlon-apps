import type {
  getGroupAndChannelUnreads,
  getInitialActivity,
} from '@tloncorp/api';
import type {
  NotificationLevel,
  Source,
  VolumeMap,
  VolumeSettings,
} from '@tloncorp/api/urbit';
import { valid } from '@urbit/aura';

import type { ChannelState } from '../channel-state-runtime';
import {
  DIARY_REMOVED,
  canonicalizeNest,
  formatPostId,
  isGroupFlag,
  parseNest,
} from '../cli-utils';
import {
  type CommandDeps,
  commandError,
  errorMessage,
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

// An explicit level; `default` (clear the setting) is handled separately.
export type SetLevel = 'loud' | 'medium' | 'soft' | 'hush';

// How an activity poke settled. A nack (eyre's `err`, a non-Error rejection) is
// definitive for the acting ship's own %activity; any Error (channel reaped,
// ack timeout, transport) leaves it unknown whether the ship applied it.
export type PokeOutcome =
  | { kind: 'acked' }
  | { kind: 'nacked'; message: string }
  | { kind: 'ambiguous'; message: string };

// What a read is sent for: a channel carries the group its source names.
export type MarkReadTarget =
  | { kind: 'dm-ship'; ship: string }
  | { kind: 'dm-club'; club: string }
  | { kind: 'group'; flag: string }
  | { kind: 'channel'; nest: string; groupId: string }
  | { kind: 'all' };

export interface ReadApi {
  // A deep read of the target, sent once.
  markRead: (target: MarkReadTarget) => Promise<PokeOutcome>;
  // The current per-source summaries (the runtime selects /v6/activity).
  getUnreads: () => Promise<ActivityInit>;
}

export interface VolumeApi {
  adjustVolumeSetting: (
    source: Source,
    volume: VolumeMap | null
  ) => Promise<PokeOutcome>;
  getVolumeSettings: () => Promise<VolumeSettings>;
}

// Pure level helpers from @tloncorp/api/urbit, injected because command
// modules cannot import values from @tloncorp/api.
export interface VolumeHelpers {
  mapForLevel: (level: SetLevel) => VolumeMap;
  levelOf: (map: VolumeMap) => NotificationLevel;
  sourceKey: (source: Source) => string;
  inheritedLevel: (
    source: Source,
    settings: VolumeSettings,
    group?: string
  ) => { label: string; volume: NotificationLevel };
  levelName: (level: NotificationLevel) => string;
}

export interface RootPost {
  id: string;
  authorId: string;
  isDeleted: boolean;
}

export interface ActivityDeps extends CommandDeps {
  authenticate: () => Promise<void>;
  activityApi: ActivityApi;
  format: ActivityFormatter;
  volumeApi: VolumeApi;
  volume: VolumeHelpers;
  readApi: ReadApi;
  isJoinedGroup: (flag: string) => Promise<boolean>;
  getChannelState: (nest: string) => Promise<ChannelState>;
  // The top-level post `id` in `nest`, or null when there is none.
  findRootPost: (nest: string, id: string) => Promise<RootPost | null>;
  getCurrentUserId: () => string;
  sleep: (ms: number) => Promise<void>;
}

export const ACTIVITY_HELP = `Usage: tlon activity <command>

Commands:
  mentions [--limit N]                      Show mention activity
  replies [--limit N]                       Show reply activity
  all [--limit N]                           Show all activity
  unreads                                   Show unread counts
  mute <target> [--self]                    Mute notifications for a DM, group, channel, or thread
  unmute <target> [--self]                  Remove a mute or custom level (back to the inherited default)
  volume <target> <level> [--self]          Set the notification level
  volume base [medium|soft|hush] [--self]   Show or set the app-wide notification level (Settings → Notifications)
  mark-read <target> [--self]               Mark a DM, group DM, group or channel read (threads included)
  mark-read --all [--self]                  Mark everything read, as the Activity tab's Mark all as read does

Targets:
  ~ship                     a DM
  0v...                     a group DM
  ~host/group               a group
  chat/~host/name           a channel (chat/ or heap/)
  <channel> <post-id>       a thread, by its root post id

Levels: loud, medium, soft, hush, default (base takes medium, soft or hush)`;

const OWNER_NOTE =
  'Bot harnesses that act for an owner run this as the owner unless --self is given; on the command line --self is accepted and uses the current credentials.';

type VolumeCommand = 'mute' | 'unmute' | 'volume';
type TargetCommand = VolumeCommand | 'mark-read';

export const ACTIVITY_COMMAND_HELP: Record<TargetCommand, string> = {
  mute: `Usage: tlon activity mute <target> [--self]
Mutes notifications the way the app does: a DM, group DM or channel goes to hush (nothing notifies); a group or thread goes to soft (only mentions and replies notify).
In the app: a chat's options → Chat/Channel/Group notifications; a thread's root post menu → Mute thread (shown once the post has replies).
${OWNER_NOTE}
Targets: ~ship | 0v... | ~host/group | chat/~host/name | heap/~host/name | <channel> <post-id>
Example: tlon activity mute ~host/book-club`,
  unmute: `Usage: tlon activity unmute <target> [--self]
Clears the target's own notification setting so it follows the inherited default (the group's, the channel's, or the app's), as the app's unmute does.
In the app: a chat's options → Chat/Channel/Group notifications; a thread's root post menu → Unmute thread (shown once the post has replies).
${OWNER_NOTE}
Example: tlon activity unmute chat/~host/general`,
  volume: `Usage: tlon activity volume <target> <level> [--self]
       tlon activity volume base [medium|soft|hush] [--self]
Levels: loud (all activity), medium (posts, mentions and replies), soft (mentions and replies), hush (nothing), default (clear the setting and follow the inherited default).
DMs and group DMs take medium, hush or default, as in the app.
base is the app-wide level from the app's Settings → Notifications, for push notifications and in-app alerts: medium (All DMs and workspace posts), soft (DMs, mentions, and replies only) or hush (Nothing). Without a level it shows the current one. Chats with their own level ignore base; Settings → Notifications lists group and channel exceptions, and activity unmute <target> returns one to the inherited level. During TlonBot revival, the app may temporarily set base to hush; applying its staged restore level later can overwrite a CLI change.
In the app: a chat's options → Chat/Channel/Group notifications; Settings → Notifications lists group and channel exceptions.
${OWNER_NOTE}
Example: tlon activity volume chat/~host/general soft
Example: tlon activity volume base soft`,
  'mark-read': `Usage: tlon activity mark-read <target> [--self]
       tlon activity mark-read --all [--self]
Marks a chat read the way the app does: a DM, group DM or channel with its threads, or a group with all its channels. --all marks everything read, group invites included, and counts what it cleared by kind (a group's channels are counted as channels too). There is no undo; mark read only when asked.
In the app: Workspaces tab → press and hold a chat → Mark as read (a group: Mark all as read); Activity tab → ⋯ → Mark all as read.
${OWNER_NOTE}
Targets: ~ship | 0v... | ~host/group | chat/~host/name | heap/~host/name (no post ids; for a notes channel, mark its group read)
Example: tlon activity mark-read ~host/book-club
Example: tlon activity mark-read --all`,
};

export const ACTIVITY_CONFIRM_ATTEMPTS = 5;
export const ACTIVITY_CONFIRM_DELAY_MS = 500;

const VOLUME_COMMANDS: readonly string[] = ['mute', 'unmute', 'volume'];
const LEVELS: readonly string[] = ['loud', 'medium', 'soft', 'hush', 'default'];
const BASE_TARGET = 'base';
const BASE_LEVELS: readonly string[] = ['medium', 'soft', 'hush'];
export const BASE_LEVELS_MESSAGE =
  'base takes medium, soft or hush (the app offers only these in Settings → Notifications)';
// Titles from the app's Settings → Notifications menu
// (NotificationLevelSelector.tsx), which command modules cannot import.
// `default` gets the medium title, as the app normalises it.
const BASE_LEVEL_TITLES: Record<NotificationLevel, string> = {
  loud: 'All activity',
  medium: 'All DMs and workspace posts',
  default: 'All DMs and workspace posts',
  soft: 'DMs, mentions, and replies only',
  hush: 'Nothing',
};
const BASE_EXCEPTIONS_NOTE = 'Chats with their own level ignore base.';
// The desk's `sym`: a lowercase letter, then lowercase letters, digits, `-`.
const SLUG = /^[a-z][a-z0-9-]*$/;

export const NOTES_VOLUME_REFUSAL =
  'Notification levels for notes channels are not supported by this command yet; change them in the app (Channel options → Channel notifications).';
export const DM_THREAD_REFUSAL =
  'Thread notification settings are supported for group channel threads only; to mute the conversation, run: activity mute <ship-or-club>';
export const NOTES_MARK_READ_REFUSAL =
  'Marking a notes channel read is not supported by this command yet; mark its group read (activity mark-read ~host/group) or use the app (press and hold the channel → Mark as read).';
export const MARK_READ_POST_ID_MESSAGE =
  'mark-read takes no post id; marking a channel or DM read also reads its threads';
export const MARK_READ_ALL_WITH_TARGET = '--all takes no target';

export type VolumeTarget =
  | { kind: 'dm-ship'; ship: string }
  | { kind: 'dm-club'; club: string }
  | { kind: 'group'; flag: string }
  | { kind: 'channel'; nest: string }
  | { kind: 'thread'; nest: string; postId: string }
  | { kind: 'base' };

// A single-token target: no base, and no thread (which takes a post id).
type SingleTokenTarget = Exclude<VolumeTarget, { kind: 'base' | 'thread' }>;

type RequestedLevel = SetLevel | 'default';

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
  | { kind: 'unreads' }
  | { kind: 'volume-help'; command: TargetCommand }
  | { kind: 'base-show' }
  | {
      kind: 'volume';
      command: VolumeCommand;
      target: VolumeTarget;
      level: RequestedLevel | null;
    }
  | { kind: 'mark-read'; target: SingleTokenTarget | { kind: 'all' } };

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

function isVolumeCommand(command: string): command is VolumeCommand {
  return VOLUME_COMMANDS.includes(command);
}

interface TargetMessages {
  notesRefusal: string;
  unrecognized: (raw: string) => string;
}

const VOLUME_TARGET_MESSAGES: TargetMessages = {
  notesRefusal: NOTES_VOLUME_REFUSAL,
  unrecognized: (raw) =>
    `Unrecognized target: ${raw}. Use ~ship, a group-DM id (0v...), ~host/group, chat/~host/name or heap/~host/name, or a channel and a post id for a thread`,
};

const MARK_READ_TARGET_MESSAGES: TargetMessages = {
  notesRefusal: NOTES_MARK_READ_REFUSAL,
  unrecognized: (raw) =>
    `Unrecognized target: ${raw}. Use ~ship, a group-DM id (0v...), ~host/group, chat/~host/name or heap/~host/name`,
};

function parseChannelTarget(
  raw: string,
  help: string,
  notesRefusal: string
): Extract<VolumeTarget, { kind: 'channel' }> {
  const invalid = () =>
    usageError(
      `Invalid channel: ${raw} (expected chat/~host/channel-slug or heap/~host/channel-slug)`,
      help
    );
  let parts: { kind: string; host: string; name: string };
  try {
    parts = parseNest(raw);
  } catch {
    throw invalid();
  }
  if (parts.kind === 'diary') {
    throw commandError(DIARY_REMOVED);
  }
  if (parts.kind === 'notes') {
    throw commandError(notesRefusal);
  }
  if (parts.kind !== 'chat' && parts.kind !== 'heap') {
    throw usageError(
      `Unsupported channel kind: ${parts.kind}. Use chat/ or heap/`,
      help
    );
  }
  if (!valid('p', parts.host) || !SLUG.test(parts.name)) {
    throw invalid();
  }
  return { kind: 'channel', nest: canonicalizeNest(raw) };
}

// Classified by the number of `/`; aura-validated, no case folding (the desk's
// parsers are lowercase-only).
function parseVolumeTarget(
  raw: string,
  help: string,
  messages: TargetMessages = VOLUME_TARGET_MESSAGES
): SingleTokenTarget {
  const slashes = raw.split('/').length - 1;
  if (slashes === 0 && raw.startsWith('0v')) {
    if (!valid('uv', raw)) {
      throw usageError(
        `Invalid group-DM id: ${raw} (expected a 0v... id such as 0v1f.abcde)`,
        help
      );
    }
    return { kind: 'dm-club', club: raw };
  }
  if (slashes === 0 && raw.startsWith('~')) {
    if (!valid('p', raw)) {
      throw usageError(
        `Invalid ship: ${raw} (expected a ship such as ~sampel-palnet)`,
        help
      );
    }
    return { kind: 'dm-ship', ship: raw };
  }
  if (slashes === 1) {
    if (!isGroupFlag(raw)) {
      throw usageError(
        `Invalid group id: ${raw} (expected ~host/group-slug)`,
        help
      );
    }
    return { kind: 'group', flag: raw };
  }
  if (slashes === 2) {
    return parseChannelTarget(raw, help, messages.notesRefusal);
  }
  throw usageError(messages.unrecognized(raw), help);
}

// Validated before formatPostId, which silently regroups malformed input.
function parseRootPostId(raw: string, help: string): string {
  if (!valid('ud', raw) && !/^(0|[1-9][0-9]*)$/.test(raw)) {
    throw usageError(
      `Invalid post id: ${raw} (expected a numeric post id such as 170.141.184.507)`,
      help
    );
  }
  return formatPostId(raw);
}

function parseVolumeArgs(
  command: VolumeCommand,
  rest: string[]
): ParsedActivityArgs {
  const help = ACTIVITY_COMMAND_HELP[command];
  if (rest.some(isHelpArg)) {
    return { kind: 'volume-help', command };
  }

  // `--self` only stops a harness from injecting owner credentials; the
  // command acts on whatever credentials it was given.
  const positionals: string[] = [];
  for (const arg of rest) {
    if (arg === '--self') continue;
    if (arg.startsWith('-')) {
      throw usageError(`Unknown option: ${arg}`, help);
    }
    positionals.push(arg);
  }

  if (command === 'volume' && positionals[0] === BASE_TARGET) {
    if (positionals.length === 1) return { kind: 'base-show' };
    if (positionals.length > 2) {
      throw usageError(`Unexpected argument: ${positionals[2]}`, help);
    }
    const raw = positionals[1];
    if (raw === 'default' || raw === 'loud') {
      throw usageError(BASE_LEVELS_MESSAGE, help);
    }
    if (!BASE_LEVELS.includes(raw)) {
      throw usageError(
        `Unknown level: ${raw}. Levels for base: medium, soft, hush`,
        help
      );
    }
    return {
      kind: 'volume',
      command,
      target: { kind: 'base' },
      level: raw as SetLevel,
    };
  }

  const minimum = command === 'volume' ? 2 : 1;
  if (positionals.length < minimum) {
    throw usageError(help);
  }
  if (positionals.length > minimum + 1) {
    throw usageError(`Unexpected argument: ${positionals[minimum + 1]}`, help);
  }

  let level: RequestedLevel | null = null;
  if (command === 'volume') {
    const raw = positionals.pop() as string;
    if (!LEVELS.includes(raw)) {
      throw usageError(
        `Unknown level: ${raw}. Levels: loud, medium, soft, hush, default`,
        help
      );
    }
    level = raw as RequestedLevel;
  }

  let target: Exclude<VolumeTarget, { kind: 'base' }> = parseVolumeTarget(
    positionals[0],
    help
  );
  if (positionals.length === 2) {
    const postId = parseRootPostId(positionals[1], help);
    if (target.kind === 'group') {
      throw usageError(
        'A thread needs a channel (chat/~host/name), not a group id',
        help
      );
    }
    if (target.kind === 'dm-ship' || target.kind === 'dm-club') {
      throw commandError(DM_THREAD_REFUSAL);
    }
    target = { kind: 'thread', nest: target.nest, postId };
  }

  if (
    (target.kind === 'dm-ship' || target.kind === 'dm-club') &&
    (level === 'loud' || level === 'soft')
  ) {
    throw usageError(
      'DMs take medium, hush or default (the app offers only these for DMs)',
      help
    );
  }

  return { kind: 'volume', command, target, level };
}

function parseMarkReadArgs(rest: string[]): ParsedActivityArgs {
  const help = ACTIVITY_COMMAND_HELP['mark-read'];
  if (rest.some(isHelpArg)) {
    return { kind: 'volume-help', command: 'mark-read' };
  }

  let all = false;
  const positionals: string[] = [];
  for (const arg of rest) {
    if (arg === '--self') continue;
    if (arg === '--all') {
      all = true;
      continue;
    }
    if (arg.startsWith('-')) {
      throw usageError(`Unknown option: ${arg}`, help);
    }
    positionals.push(arg);
  }

  if (all) {
    if (positionals.length > 0) {
      throw usageError(MARK_READ_ALL_WITH_TARGET, help);
    }
    return { kind: 'mark-read', target: { kind: 'all' } };
  }
  if (positionals.length === 0) {
    throw usageError(help);
  }
  if (positionals.length > 1) {
    throw usageError(
      `Unexpected argument: ${positionals[1]}. ${MARK_READ_POST_ID_MESSAGE}`,
      help
    );
  }
  return {
    kind: 'mark-read',
    target: parseVolumeTarget(positionals[0], help, MARK_READ_TARGET_MESSAGES),
  };
}

function parseArgs(args: string[]): ParsedActivityArgs {
  const command = args[0];

  if (isHelpArg(command)) {
    return { kind: 'help' };
  }

  if (!command) {
    throw usageError(ACTIVITY_HELP);
  }

  if (isVolumeCommand(command)) {
    return parseVolumeArgs(command, args.slice(1));
  }

  if (command === 'mark-read') {
    return parseMarkReadArgs(args.slice(1));
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

interface ResolvedChannel {
  nest: string;
  groupId: string;
}

// A target resolved to the exact source noun the app would send. Channel and
// thread sources carry the group (and a thread its root author), which the
// stored settings key omits, so those are re-read before confirming.
interface ResolvedTarget {
  source: Source;
  label: string;
  where: string;
  channel?: ResolvedChannel;
  root?: { id: string; authorId: string };
}

type VolumeRequest = {
  command: VolumeCommand;
  target: VolumeTarget;
  // What is sent: a level's map, or null to clear the target's own setting.
  level: SetLevel | null;
  // The level the user named (volume only).
  requested: RequestedLevel | null;
};

function muteLevel(target: VolumeTarget): SetLevel {
  return target.kind === 'group' || target.kind === 'thread' ? 'soft' : 'hush';
}

function toRequest(
  command: VolumeCommand,
  target: VolumeTarget,
  requested: RequestedLevel | null
): VolumeRequest {
  if (command === 'mute') {
    return { command, target, level: muteLevel(target), requested };
  }
  if (command === 'unmute' || requested === 'default') {
    return { command, target, level: null, requested };
  }
  return { command, target, level: requested, requested };
}

function targetLabel(target: VolumeTarget): string {
  switch (target.kind) {
    case 'dm-ship':
      return `DM with ${target.ship}`;
    case 'dm-club':
      return `group DM ${target.club}`;
    case 'group':
      return `group ${target.flag}`;
    case 'channel':
      return `channel ${target.nest}`;
    case 'thread':
      return `thread ${target.postId} in ${target.nest}`;
    case 'base':
      return 'base notification level';
  }
}

function targetWhere(target: VolumeTarget): string {
  switch (target.kind) {
    case 'dm-ship':
    case 'dm-club':
      return 'Chat options → Chat notifications';
    case 'group':
      return 'Group options → Group notifications';
    case 'channel':
      return 'Channel options → Channel notifications';
    case 'thread':
      return "the root post's message menu → Mute thread / Unmute thread (shown once the post has replies)";
    case 'base':
      return 'Settings → Notifications';
  }
}

async function resolveChannel(
  nest: string,
  deps: ActivityDeps
): Promise<ResolvedChannel> {
  let state: ChannelState;
  try {
    state = await deps.getChannelState(nest);
  } catch (error) {
    throw commandError(
      `Could not read channels: ${errorMessage(error)}; nothing changed.`
    );
  }
  if (!state.joined) {
    throw commandError(
      `Channel ${nest} is not joined on this ship; nothing changed.`
    );
  }
  return { nest, groupId: state.groupId };
}

async function resolveTarget(
  target: VolumeTarget,
  deps: ActivityDeps
): Promise<ResolvedTarget> {
  const label = targetLabel(target);
  const where = targetWhere(target);
  switch (target.kind) {
    case 'dm-ship':
      return { source: { dm: { ship: target.ship } }, label, where };
    case 'dm-club':
      return { source: { dm: { club: target.club } }, label, where };
    case 'group': {
      let joined: boolean;
      try {
        joined = await deps.isJoinedGroup(target.flag);
      } catch (error) {
        throw commandError(
          `Could not read groups: ${errorMessage(error)}; nothing changed.`
        );
      }
      if (!joined) {
        throw commandError(
          `Group ${target.flag} is not joined on this ship; nothing changed.`
        );
      }
      return { source: { group: target.flag }, label, where };
    }
    case 'channel': {
      const channel = await resolveChannel(target.nest, deps);
      return {
        source: { channel: { nest: channel.nest, group: channel.groupId } },
        label,
        where,
        channel,
      };
    }
    case 'thread': {
      const channel = await resolveChannel(target.nest, deps);
      let root: RootPost | null;
      try {
        root = await deps.findRootPost(target.nest, target.postId);
      } catch (error) {
        throw commandError(
          `Could not read ${target.nest}: ${errorMessage(error)}; nothing changed.`
        );
      }
      if (!root || root.isDeleted) {
        throw commandError(
          `Could not find top-level post ${target.postId} in ${target.nest}; nothing changed. Threads are muted by their root post id.`
        );
      }
      return {
        source: {
          thread: {
            channel: channel.nest,
            group: channel.groupId,
            key: {
              id: `${root.authorId}/${target.postId}`,
              time: target.postId,
            },
          },
        },
        label,
        where,
        channel,
        root: { id: target.postId, authorId: root.authorId },
      };
    }
    case 'base':
      return { source: { base: null }, label, where };
  }
}

function couldNotMessage(request: VolumeRequest, label: string): string {
  switch (request.command) {
    case 'mute':
      return `Could not mute ${label}`;
    case 'unmute':
      return `Could not unmute ${label}`;
    case 'volume':
      return `Could not set ${label} to ${request.requested}`;
  }
}

function verbPhrase(request: VolumeRequest, label: string): string {
  switch (request.command) {
    case 'mute':
      return `Mute of ${label}`;
    case 'unmute':
      return `Unmute of ${label}`;
    case 'volume':
      return `Setting ${label} to ${request.requested}`;
  }
}

function confirmedHeader(
  request: VolumeRequest,
  label: string,
  ship: string
): string {
  switch (request.command) {
    case 'mute':
      return `✓ Muted ${label} for ${ship}`;
    case 'unmute':
      return `✓ Unmuted ${label} for ${ship}`;
    case 'volume':
      return `✓ Set ${label} to ${request.requested} for ${ship}`;
  }
}

// Every sent key must be stored with the same `unreads` and `notify`; extra
// stored keys are fine (the desk merges into the existing map).
function mapDiffs(sent: VolumeMap, stored: VolumeMap): string[] {
  const diffs: string[] = [];
  for (const [key, want] of Object.entries(sent)) {
    if (!want) continue;
    const have = stored[key as keyof VolumeMap];
    if (!have) {
      diffs.push(`${key} (missing)`);
    } else if (have.notify !== want.notify || have.unreads !== want.unreads) {
      diffs.push(
        `${key} (stored notify ${have.notify}, unreads ${have.unreads}; sent notify ${want.notify}, unreads ${want.unreads})`
      );
    }
  }
  return diffs;
}

// The stored key omits the channel's group and the root's author, so a match
// only counts if both are unchanged since the source was built. Returns why
// not, or null when nothing changed.
async function recheckIdentity(
  resolved: ResolvedTarget,
  deps: ActivityDeps,
  during = 'while the setting was applied, so it may not take effect'
): Promise<string | null> {
  if (!resolved.channel) return null;
  const { nest, groupId } = resolved.channel;
  let state: ChannelState;
  try {
    state = await deps.getChannelState(nest);
  } catch (error) {
    return `the channel could not be re-read (${errorMessage(error)})`;
  }
  if (!state.joined) {
    return `${nest} is no longer joined`;
  }
  if (state.groupId !== groupId) {
    return `the channel's group changed from ${groupId} to ${state.groupId} ${during}`;
  }
  if (!resolved.root) return null;
  const { id, authorId } = resolved.root;
  let root: RootPost | null;
  try {
    root = await deps.findRootPost(nest, id);
  } catch (error) {
    return `the root post could not be re-read (${errorMessage(error)})`;
  }
  if (!root || root.isDeleted) {
    return `root post ${id} is no longer found`;
  }
  if (root.authorId !== authorId) {
    return `the root post's author changed from ${authorId} to ${root.authorId} ${during}`;
  }
  return null;
}

function unconfirmedError(
  phrase: string,
  reason: string,
  pokeError: string | null,
  lastReadError: string | null
): Error {
  const pokeSuffix = pokeError ? ` (poke error: ${pokeError})` : '';
  const readSuffix = lastReadError
    ? ` (last read error: ${lastReadError})`
    : '';
  return commandError(
    `${phrase} was sent but is not confirmed: ${reason}. Running the command again is safe.${pokeSuffix}${readSuffix}`
  );
}

function levelText(level: NotificationLevel, deps: ActivityDeps): string {
  return `${level} (${deps.volume.levelName(level)})`;
}

async function setVolume(
  request: VolumeRequest,
  deps: ActivityDeps
): Promise<void> {
  const resolved = await resolveTarget(request.target, deps);
  const { source, label } = resolved;
  // Base writes also reset `contact`: old app versions wrote full base maps
  // (the desk's %loud template notifies on it) and %adjust merges, so a
  // stale `contact` would otherwise survive every level change unverified.
  const sent = request.level
    ? request.target.kind === 'base'
      ? {
          ...deps.volume.mapForLevel(request.level),
          contact: { unreads: false, notify: false },
        }
      : deps.volume.mapForLevel(request.level)
    : null;

  const outcome = await deps.volumeApi.adjustVolumeSetting(source, sent);
  if (outcome.kind === 'nacked') {
    throw commandError(
      `${couldNotMessage(request, label)}: ${outcome.message}`
    );
  }
  const ambiguous = outcome.kind === 'ambiguous';
  const pokeError = ambiguous ? outcome.message : null;

  const key = deps.volume.sourceKey(source);
  // An acked clear is definitive. A channel or thread entry left under the key
  // may be an older one written under another group or root author: same key,
  // different noun, so it never goes away and cannot gate the clear.
  const clearedOnAck = !sent && !ambiguous && resolved.channel !== undefined;
  let settings: VolumeSettings | null = null;
  let lastReadError: string | null = null;
  let satisfied = false;
  for (let attempt = 1; attempt <= ACTIVITY_CONFIRM_ATTEMPTS; attempt += 1) {
    try {
      settings = await deps.volumeApi.getVolumeSettings();
      const stored = settings[key] ?? null;
      satisfied = sent
        ? stored !== null && mapDiffs(sent, stored).length === 0
        : clearedOnAck || stored === null;
    } catch (error) {
      lastReadError = errorMessage(error);
    }
    if (satisfied) break;
    if (attempt < ACTIVITY_CONFIRM_ATTEMPTS) {
      await deps.sleep(ACTIVITY_CONFIRM_DELAY_MS);
    }
  }

  if (!satisfied || !settings) {
    const stored = settings ? (settings[key] ?? null) : null;
    let observed: string;
    if (!settings) {
      observed = 'unreadable';
    } else if (sent && stored) {
      const inferred = deps.volume.levelOf(stored);
      observed =
        inferred === request.level
          ? `${inferred} but differs from the requested entries: ${mapDiffs(sent, stored).join(', ')}`
          : inferred;
    } else if (sent) {
      observed = 'not set (follows the default)';
    } else {
      observed = `still ${deps.volume.levelOf(stored as VolumeMap)}`;
    }
    throw unconfirmedError(
      verbPhrase(request, label),
      `the stored setting is ${observed}`,
      pokeError,
      lastReadError
    );
  }

  // Without an ack, a matching channel or thread entry may be an older one
  // written under another group or root author: same key, different noun.
  if (sent && ambiguous && resolved.channel) {
    throw unconfirmedError(
      verbPhrase(request, label),
      `the stored entry matches, but the poke was not acknowledged and the entry cannot be told apart from an older one for this ${resolved.root ? 'thread under another group or root author' : 'channel under another group'}`,
      pokeError,
      null
    );
  }

  const changed = await recheckIdentity(resolved, deps);
  if (changed) {
    throw unconfirmedError(
      verbPhrase(request, label),
      changed,
      pokeError,
      null
    );
  }

  const lines = [confirmedHeader(request, label, deps.getCurrentUserId())];
  const stored = settings[key] ?? null;
  if (sent && stored) {
    const inferred = deps.volume.levelOf(stored);
    lines.push(
      request.target.kind === 'base'
        ? `  Level: ${inferred} (${BASE_LEVEL_TITLES[inferred]})`
        : `  Level: ${levelText(inferred, deps)}`
    );
    if (inferred !== request.level) {
      lines.push(
        `  Note: The stored map infers ${inferred} because it also contains legacy entries; all requested entries were verified.`
      );
    }
  } else {
    const inherited = deps.volume.inheritedLevel(
      source,
      settings,
      resolved.channel?.groupId
    );
    lines.push(
      `  Level: default (follows ${inherited.label}: ${levelText(inherited.volume, deps)})`
    );
  }
  if (request.target.kind === 'base') {
    lines.push(`  ${BASE_EXCEPTIONS_NOTE}`);
  }
  lines.push(`  In the app: ${resolved.where}`);
  writeLine(deps.stdout, lines.join('\n'));
}

async function showBaseLevel(deps: ActivityDeps): Promise<void> {
  const settings = await deps.volumeApi.getVolumeSettings();
  const stored = settings.base ?? null;
  // A missing %base reads as the desk's bunt, default-volumes, which infers
  // medium; the app shows medium too.
  const level = stored ? deps.volume.levelOf(stored) : 'medium';
  writeLine(
    deps.stdout,
    [
      `Base notification level for ${deps.getCurrentUserId()}: ${level} (${BASE_LEVEL_TITLES[level]})`,
      `  ${BASE_EXCEPTIONS_NOTE}`,
      '  In the app: Settings → Notifications',
    ].join('\n')
  );
}

type UnreadSummary = GroupUnread | ChannelUnread;

// How a source reads after the poke. Without an ack the read may never have
// applied: a clear summary only counts when it was unread before, since a
// summary cannot show thread replies that did not notify. `new-activity`
// needs an ack too: an acked read refreshes the summaries in the poke's own
// event, so newer activity arrived after it.
type ReadState = 'cleared' | 'new-activity' | 'unconfirmed';

function readState(
  before: UnreadSummary | undefined,
  after: UnreadSummary | undefined,
  acked: boolean
): ReadState {
  if (!after || !hasUnread(after)) {
    return acked || (before !== undefined && hasUnread(before))
      ? 'cleared'
      : 'unconfirmed';
  }
  if (acked && after.updatedAt > (before?.updatedAt ?? 0)) {
    return 'new-activity';
  }
  return 'unconfirmed';
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function unreadText(summary: UnreadSummary): string {
  const count = summary.count ?? 0;
  return count > 0 ? plural(count, 'unread', 'unreads') : 'a notification';
}

function clearedText(before: UnreadSummary | undefined): string {
  if (!before || !hasUnread(before)) return 'no reported unreads';
  const count = before.count ?? 0;
  return count > 0
    ? `cleared ${plural(count, 'unread', 'unreads')}`
    : 'cleared its notification';
}

function markReadWhere(target: SingleTokenTarget | { kind: 'all' }): string {
  switch (target.kind) {
    case 'dm-ship':
    case 'dm-club':
      return 'Workspaces tab → press and hold the chat → Mark as read';
    case 'channel':
      return 'open its group → press and hold the channel → Mark as read';
    case 'group':
      return 'Workspaces tab → press and hold the group → Mark all as read';
    case 'all':
      return 'Activity tab → ⋯ → Mark all as read';
  }
}

function toMarkReadTarget(
  target: SingleTokenTarget,
  resolved: ResolvedTarget
): MarkReadTarget {
  if (target.kind !== 'channel') return target;
  // resolveTarget sets `channel` for every channel target.
  const { nest, groupId } = resolved.channel as ResolvedChannel;
  return { kind: 'channel', nest, groupId };
}

// The summary keys omit a channel's group, so a channel matches by nest alone.
function findSummary(
  init: ActivityInit,
  target: MarkReadTarget
): UnreadSummary | undefined {
  switch (target.kind) {
    case 'dm-ship':
    case 'dm-club': {
      const id = target.kind === 'dm-ship' ? target.ship : target.club;
      return init.channelUnreads.find(
        (summary) => summary.type === 'dm' && summary.channelId === id
      );
    }
    case 'group':
      return init.groupUnreads.find(
        (summary) => summary.groupId === target.flag
      );
    case 'channel':
      return init.channelUnreads.find(
        (summary) =>
          summary.type === 'channel' && summary.channelId === target.nest
      );
    case 'all':
      return undefined;
  }
}

async function readSnapshot(deps: ActivityDeps): Promise<ActivityInit> {
  try {
    return await deps.readApi.getUnreads();
  } catch (error) {
    throw commandError(
      `Could not read unreads: ${errorMessage(error)}; nothing changed.`
    );
  }
}

async function markRead(
  target: SingleTokenTarget,
  deps: ActivityDeps
): Promise<void> {
  const resolved = await resolveTarget(target, deps);
  const { label } = resolved;
  const sent = toMarkReadTarget(target, resolved);
  const before = findSummary(await readSnapshot(deps), sent);

  // Sent even when the snapshot shows nothing: a channel's summary omits
  // thread replies that did not notify, and a repeated read is harmless.
  const outcome = await deps.readApi.markRead(sent);
  if (outcome.kind === 'nacked') {
    throw commandError(`Could not mark ${label} read: ${outcome.message}`);
  }
  const acked = outcome.kind === 'acked';
  const pokeError = acked ? null : outcome.message;

  // Unacknowledged, with nothing visible before: no read-back can show
  // whether the read applied, so one successful read ends the loop.
  const provable = acked || (before !== undefined && hasUnread(before));
  let after: UnreadSummary | undefined;
  let read = false;
  let state: ReadState = 'unconfirmed';
  let lastReadError: string | null = null;
  for (let attempt = 1; attempt <= ACTIVITY_CONFIRM_ATTEMPTS; attempt += 1) {
    try {
      after = findSummary(await deps.readApi.getUnreads(), sent);
      read = true;
      state = readState(before, after, acked);
    } catch (error) {
      lastReadError = errorMessage(error);
    }
    if (state !== 'unconfirmed' || (read && !provable)) break;
    if (attempt < ACTIVITY_CONFIRM_ATTEMPTS) {
      await deps.sleep(ACTIVITY_CONFIRM_DELAY_MS);
    }
  }

  const phrase = `Mark read of ${label}`;
  // A read sent under a group the channel no longer belongs to is an acked
  // no-op on the desk, and the summary key omits the group, so a cleared or
  // newer summary only counts if the group is unchanged; when the unreads
  // remain, the group change is the likelier cause.
  const changed = await recheckIdentity(
    resolved,
    deps,
    'while the read was sent, so the read may not have applied'
  );
  if (state === 'unconfirmed') {
    let reason = 'the unreads could not be read';
    if (after && hasUnread(after)) {
      reason = `it still shows ${unreadText(after)}`;
      if (after.updatedAt > (before?.updatedAt ?? 0)) {
        reason +=
          ', and new activity arrived, so it is unknown whether the read applied';
      }
    } else if (read) {
      reason =
        'the read was not acknowledged and its summary cannot show thread-only unreads';
    }
    throw unconfirmedError(phrase, changed ?? reason, pokeError, lastReadError);
  }
  if (changed) {
    throw unconfirmedError(phrase, changed, pokeError, null);
  }

  const ship = deps.getCurrentUserId();
  const header =
    state === 'new-activity' && after
      ? `✓ Marked ${label} read for ${ship}; new activity arrived after the read (${unreadText(after)} now)`
      : `✓ Marked ${label} read for ${ship} (${clearedText(before)})`;
  writeLine(
    deps.stdout,
    [header, `  In the app: ${markReadWhere(target)}`].join('\n')
  );
}

type SourceKind = 'channel' | 'dm' | 'club' | 'group';

interface SourceUnread {
  kind: SourceKind;
  label: string;
  summary: UnreadSummary;
}

const SOURCE_KIND_NOUNS: Array<[SourceKind, string, string]> = [
  ['channel', 'channel', 'channels'],
  ['dm', 'DM', 'DMs'],
  ['club', 'group DM', 'group DMs'],
  ['group', 'group', 'groups'],
];

// At most this many residual sources are named; the rest are counted.
const RESIDUAL_LIST_LIMIT = 20;

// Every channel, DM and group summary (notebooks are channels under notes/),
// keyed by source; the base summary only aggregates them.
function unreadsBySource(init: ActivityInit): Map<string, SourceUnread> {
  const sources = new Map<string, SourceUnread>();
  for (const summary of init.channelUnreads) {
    const id = summary.channelId;
    if (summary.type === 'channel') {
      sources.set(`channel/${id}`, {
        kind: 'channel',
        label: targetLabel({ kind: 'channel', nest: id }),
        summary,
      });
    } else if (id.startsWith('0v')) {
      sources.set(`club/${id}`, {
        kind: 'club',
        label: targetLabel({ kind: 'dm-club', club: id }),
        summary,
      });
    } else {
      sources.set(`ship/${id}`, {
        kind: 'dm',
        label: targetLabel({ kind: 'dm-ship', ship: id }),
        summary,
      });
    }
  }
  for (const summary of init.groupUnreads) {
    sources.set(`group/${summary.groupId}`, {
      kind: 'group',
      label: targetLabel({ kind: 'group', flag: summary.groupId }),
      summary,
    });
  }
  return sources;
}

interface SourceResult {
  state: ReadState;
  source: SourceUnread;
}

function bounded(items: string[]): { shown: string[]; more: number } {
  return {
    shown: items.slice(0, RESIDUAL_LIST_LIMIT),
    more: Math.max(0, items.length - RESIDUAL_LIST_LIMIT),
  };
}

async function markAllRead(deps: ActivityDeps): Promise<void> {
  const before = unreadsBySource(await readSnapshot(deps));
  const snapshotUnread = [...before]
    .filter(([, source]) => hasUnread(source.summary))
    .map(([key]) => key);

  const outcome = await deps.readApi.markRead({ kind: 'all' });
  if (outcome.kind === 'nacked') {
    throw commandError(`Could not mark everything read: ${outcome.message}`);
  }
  const acked = outcome.kind === 'acked';
  const pokeError = acked ? null : outcome.message;

  // Sources unread in the snapshot or now: a source that appears only after
  // the poke is new activity when acked, and unconfirmed otherwise.
  let results: Map<string, SourceResult> | null = null;
  let lastReadError: string | null = null;
  for (let attempt = 1; attempt <= ACTIVITY_CONFIRM_ATTEMPTS; attempt += 1) {
    try {
      const after = unreadsBySource(await deps.readApi.getUnreads());
      const keys = new Set(snapshotUnread);
      for (const [key, source] of after) {
        if (hasUnread(source.summary)) keys.add(key);
      }
      const next = new Map<string, SourceResult>();
      for (const key of keys) {
        const was = before.get(key);
        const now = after.get(key);
        next.set(key, {
          state: readState(was?.summary, now?.summary, acked),
          // Every key comes from one of the two maps.
          source: (now ?? was) as SourceUnread,
        });
      }
      results = next;
    } catch (error) {
      lastReadError = errorMessage(error);
    }
    if (
      results &&
      ![...results.values()].some((result) => result.state === 'unconfirmed')
    ) {
      break;
    }
    if (attempt < ACTIVITY_CONFIRM_ATTEMPTS) {
      await deps.sleep(ACTIVITY_CONFIRM_DELAY_MS);
    }
  }

  if (!results) {
    throw unconfirmedError(
      'Mark all read',
      'the unreads could not be read',
      pokeError,
      lastReadError
    );
  }
  // Unacknowledged, with nothing visible before: an all-clear read-back
  // cannot show whether the read applied.
  if (
    !acked &&
    snapshotUnread.length === 0 &&
    ![...results.values()].some((result) => result.state === 'unconfirmed')
  ) {
    throw unconfirmedError(
      'Mark all read',
      'the read was not acknowledged and summaries cannot show thread-only unreads',
      pokeError,
      lastReadError
    );
  }
  const byState = (state: ReadState) =>
    [...results.values()].filter((result) => result.state === state);

  const unconfirmed = byState('unconfirmed');
  if (unconfirmed.length > 0) {
    const { shown, more } = bounded(
      unconfirmed.map(
        ({ source }) => `${source.label} (${unreadText(source.summary)})`
      )
    );
    const count =
      unconfirmed.length === 1
        ? '1 source still shows unreads'
        : `${unconfirmed.length} sources still show unreads`;
    throw unconfirmedError(
      'Mark all read',
      `${count}: ${shown.join(', ')}${more > 0 ? `, and ${more} more` : ''}`,
      pokeError,
      lastReadError
    );
  }

  // Only sources unread in the snapshot and clear now count as cleared; one
  // that shows new activity is listed below instead.
  const cleared = new Map<SourceKind, number>();
  for (const key of snapshotUnread) {
    const result = results.get(key);
    if (result?.state === 'cleared') {
      cleared.set(
        result.source.kind,
        (cleared.get(result.source.kind) ?? 0) + 1
      );
    }
  }
  const clearedParts = SOURCE_KIND_NOUNS.filter(([kind]) =>
    cleared.has(kind)
  ).map(([kind, one, many]) => plural(cleared.get(kind) ?? 0, one, many));

  const ship = deps.getCurrentUserId();
  const lines = [
    snapshotUnread.length === 0
      ? `✓ Marked all read for ${ship} (no reported unreads)`
      : `✓ Marked all read for ${ship}`,
  ];
  if (clearedParts.length > 0) {
    lines.push(`  Cleared: ${clearedParts.join(', ')}`);
  }
  const fresh = byState('new-activity');
  if (fresh.length > 0) {
    const { shown, more } = bounded(
      fresh.map(
        ({ source }) => `${source.label}: ${unreadText(source.summary)}`
      )
    );
    lines.push(
      `  New activity arrived after the read in ${plural(fresh.length, 'source', 'sources')}:`,
      ...shown.map((line) => `    ${line}`)
    );
    if (more > 0) lines.push(`    and ${more} more`);
  }
  lines.push(`  In the app: ${markReadWhere({ kind: 'all' })}`);
  writeLine(deps.stdout, lines.join('\n'));
}

export async function run(args: string[], deps: ActivityDeps): Promise<number> {
  try {
    const parsed = parseArgs(args);
    if (parsed.kind === 'help') {
      return writeHelp(deps, ACTIVITY_HELP);
    }
    if (parsed.kind === 'volume-help') {
      return writeHelp(deps, ACTIVITY_COMMAND_HELP[parsed.command]);
    }

    await deps.authenticate();

    if (parsed.kind === 'base-show') {
      await showBaseLevel(deps);
    } else if (parsed.kind === 'mark-read') {
      if (parsed.target.kind === 'all') {
        await markAllRead(deps);
      } else {
        await markRead(parsed.target, deps);
      }
    } else if (parsed.kind === 'volume') {
      await setVolume(
        toRequest(parsed.command, parsed.target, parsed.level),
        deps
      );
    } else if (parsed.kind === 'unreads') {
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
