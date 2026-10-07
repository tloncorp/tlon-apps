import type {
  StewardAutomationDelivery,
  StewardAutomationSchedule,
  StewardAutomationShipTasks,
  StewardAutomationTask,
  StewardAutomationTaskInput,
  StewardAutomationUpdate,
} from '@tloncorp/api/urbit';
import { notesPermissionsCompatActive } from '@tloncorp/shared/logic/notesPermissionsCompat';

// Copied from the OpenClaw plugin (cron-budget-hold.ts and
// steward-automation-edit.ts). The plugin writes both markers into a job's
// description, and the mirror hands them to us verbatim.
const BUDGET_HOLD_PREFIX = '[Paused: credit budget] ';
const ONBOARDING_SLOT_PREFIX = 'tlon-agent-primary:';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** A daily or weekly time, the only schedule shape the editor can change. */
export interface EditableSchedule {
  /** Days of the week, 0 = Sunday, sorted and unique. All seven means daily. */
  days: number[];
  hour: number;
  minute: number;
}

export type AutomationDestination =
  | { kind: 'none' }
  | { kind: 'dm'; ship: string }
  | { kind: 'channel'; nest: string }
  | { kind: 'other'; label: string };

export interface AutomationTaskDraft {
  name: string;
  prompt: string;
  /** Null when the task's schedule is not a daily or weekly time. */
  schedule: EditableSchedule | null;
  destination: AutomationDestination;
}

export type AutomationTaskStatus = 'active' | 'paused' | 'held';

export interface AutomationSnapshot {
  available: boolean;
  tasks: StewardAutomationShipTasks;
}

function cronNumber(value: string, minimum: number, maximum: number) {
  if (!/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return number >= minimum && number <= maximum ? number : undefined;
}

// 0-7, where both 0 and 7 are Sunday; names map onto 0-6.
function cronDayNumber(value: string) {
  const named = DAY_NAMES.indexOf(value.toLowerCase());
  return named !== -1 ? named : cronNumber(value, 0, 7);
}

function parseCronDays(field: string): number[] | null {
  if (field === '*') return ALL_DAYS;
  const days = new Set<number>();
  for (const part of field.split(',')) {
    const [from, to, ...rest] = part.split('-');
    if (rest.length) return null;
    const start = cronDayNumber(from);
    const end = to === undefined ? start : cronDayNumber(to);
    if (start === undefined || end === undefined) return null;
    // A range that runs past Saturday ("5-7", "fri-mon") wraps into the
    // next week; fold each day back to 0-6 only after walking it.
    const last = end < start ? end + 7 : end;
    for (let day = start; day <= last; day += 1) days.add(day % 7);
  }
  return days.size ? [...days].sort((x, y) => x - y) : null;
}

export function parseEditableSchedule(
  schedule?: StewardAutomationSchedule
): EditableSchedule | null {
  if (schedule?.kind !== 'cron' || !schedule.expr) return null;
  const fields = schedule.expr.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minuteField, hourField, dayOfMonth, month, dayOfWeek] = fields;
  const minute = cronNumber(minuteField, 0, 59);
  const hour = cronNumber(hourField, 0, 23);
  if (minute === undefined || hour === undefined) return null;
  if (dayOfMonth !== '*' || month !== '*') return null;
  const days = parseCronDays(dayOfWeek);
  return days ? { days, hour, minute } : null;
}

export function cronExpressionFor({ days, hour, minute }: EditableSchedule) {
  const unique = [...new Set(days)].sort((a, b) => a - b);
  const dayField = unique.length === 7 ? '*' : unique.join(',');
  return `${minute} ${hour} * * ${dayField}`;
}

function sameSchedule(a: EditableSchedule | null, b: EditableSchedule | null) {
  if (!a || !b) return a === b;
  return cronExpressionFor(a) === cronExpressionFor(b);
}

const TARGET_SHIP = /^~?[a-z-]+$/i;
const TARGET_NEST = /^([^/]+)\/([^/]+)\/([^/]+)$/;
const TARGET_NEST_KINDS = ['chat', 'heap', 'diary', 'notes'];

function targetShip(raw: string) {
  const ship = raw.trim().toLowerCase();
  return ship.startsWith('~') ? ship : `~${ship}`;
}

function targetNest(raw: string) {
  const match = TARGET_NEST.exec(raw.trim());
  const kind = match?.[1].toLowerCase();
  if (!match || !kind || !TARGET_NEST_KINDS.includes(kind)) return null;
  return `${kind}/${targetShip(match[2])}/${match[3]}`;
}

/**
 * A delivery target as the bot reads it. This follows `parseTlonTarget` in
 * the OpenClaw plugin: `dm/~ship` or a bare ship is a DM, a
 * `kind/~host/name` nest is a channel, optionally behind `group:` or
 * `room:`, where a two-part `~host/name` means a chat channel.
 */
function parseTarget(raw: string): AutomationDestination | null {
  const target = raw.trim().replace(/^tlon:/i, '');
  const dm = /^dm[/:](.+)$/i.exec(target);
  if (dm) return { kind: 'dm', ship: targetShip(dm[1]) };
  const grouped = /^(?:group|room)[/:](.+)$/i.exec(target);
  if (grouped) {
    const inner = grouped[1].trim();
    const nest = targetNest(inner);
    if (nest) return { kind: 'channel', nest };
    const parts = inner.split('/');
    return parts.length === 2
      ? { kind: 'channel', nest: `chat/${targetShip(parts[0])}/${parts[1]}` }
      : null;
  }
  const nest = targetNest(target);
  if (nest) return { kind: 'channel', nest };
  return TARGET_SHIP.test(target)
    ? { kind: 'dm', ship: targetShip(target) }
    : null;
}

/** Where a task posts, read from the delivery block the bot stores. */
export function destinationFromDelivery(
  delivery?: StewardAutomationDelivery
): AutomationDestination {
  if (!delivery || !delivery.mode || delivery.mode === 'none') {
    return { kind: 'none' };
  }
  if (delivery.mode === 'webhook') {
    return { kind: 'other', label: 'Webhook' };
  }
  const to = delivery.to?.trim() ?? '';
  if (delivery.channel === 'last' && !to) {
    return { kind: 'other', label: 'Most recent conversation' };
  }
  if (delivery.channel && !['tlon', 'last'].includes(delivery.channel)) {
    return { kind: 'other', label: to || delivery.channel };
  }
  if (!to) return { kind: 'none' };
  return parseTarget(to) ?? { kind: 'other', label: to };
}

/** What is known on this device about where a bot can post. */
export interface BotDelivery {
  botShip: string;
  ownerShip: string;
  /** The groups the bot has a seat in. */
  botGroupIds: ReadonlySet<string>;
  /** The bot's roles in each of those groups, by group id. */
  botRoles: ReadonlyMap<string, ReadonlySet<string>>;
  /** The roles that may write in a channel, by channel id; none means anyone. */
  writerRoles: ReadonlyMap<string, readonly string[]>;
  /** The roles that may read a channel, by channel id; none means anyone. */
  readerRoles: ReadonlyMap<string, readonly string[]>;
}

/**
 * Gathers what the device holds about a bot's seats, its roles and the
 * channels' writer and reader roles. Until all of them have loaded the bot
 * is taken to be in no group, so no channel is offered on a partial answer.
 */
export function botDeliveryFrom({
  botShip,
  ownerShip,
  seats,
  roles,
  writers,
  readers,
}: {
  botShip: string;
  ownerShip: string;
  seats?: { groupId: string | null }[];
  roles?: { groupId: string; roleId: string }[];
  writers?: { channelId: string; roleId: string }[];
  readers?: { channelId: string; roleId: string }[];
}): BotDelivery {
  const botGroupIds = new Set<string>();
  const botRoles = new Map<string, Set<string>>();
  const byChannel = (rows: { channelId: string; roleId: string }[]) => {
    const roleIds = new Map<string, string[]>();
    for (const { channelId, roleId } of rows) {
      roleIds.set(channelId, [...(roleIds.get(channelId) ?? []), roleId]);
    }
    return roleIds;
  };
  const known = seats && roles && writers && readers;
  if (known) {
    for (const { groupId } of seats) {
      if (groupId) botGroupIds.add(groupId);
    }
    for (const { groupId, roleId } of roles) {
      botRoles.set(groupId, (botRoles.get(groupId) ?? new Set()).add(roleId));
    }
  }
  return {
    botShip,
    ownerShip,
    botGroupIds,
    botRoles,
    writerRoles: byChannel(known ? writers : []),
    readerRoles: byChannel(known ? readers : []),
  };
}

// The role that makes a member an admin, as useIsAdmin reads it.
const ADMIN_ROLE = 'admin';

/**
 * Where a task would post if this conversation were picked, or null when the
 * bot could not deliver there. The bot posts into its own DM with the owner,
 * or into a channel it may write in, addressed by a nest its target parser
 * accepts.
 *
 * Writing follows the group's own rule (the writers scry in %groups): a
 * member must be able to read a channel to write in it, each of the two asks
 * for one of the channel's roles when it names any, and the group's host and
 * its admins may do both whatever the channel asks.
 */
export function destinationForChannel(
  channel: { id: string; type: string; groupId?: string | null },
  {
    botShip,
    ownerShip,
    botGroupIds,
    botRoles,
    writerRoles,
    readerRoles,
  }: BotDelivery
): AutomationDestination | null {
  if (channel.type === 'dm') {
    return channel.id === botShip ? { kind: 'dm', ship: ownerShip } : null;
  }
  if (channel.type === 'groupDm') return null;
  const { groupId } = channel;
  const nest = targetNest(channel.id);
  if (!nest || !groupId || !botGroupIds.has(groupId)) {
    return null;
  }
  const roles = botRoles.get(groupId);
  const isAdmin =
    groupId.startsWith(`${botShip}/`) || Boolean(roles?.has(ADMIN_ROLE));
  if (isAdmin) return { kind: 'channel', nest };
  const lacksOneOf = (asked: readonly string[] = []) =>
    asked.length > 0 && !asked.some((role) => roles?.has(role));
  if (lacksOneOf(readerRoles.get(channel.id))) return null;
  // A notes notebook has one permission: whoever may read it may edit it,
  // and any writer roles it still carries are stale.
  if (
    !notesPermissionsCompatActive(channel.type) &&
    lacksOneOf(writerRoles.get(channel.id))
  ) {
    return null;
  }
  return { kind: 'channel', nest };
}

/**
 * The groups whose channels are left out for want of a bot seat. This device
 * may simply not hold their full member lists yet.
 */
export function groupsMissingBot(
  channels: Iterable<{ type: string; groupId?: string | null }>,
  botGroupIds: ReadonlySet<string>
): string[] {
  const missing = new Set<string>();
  for (const { type, groupId } of channels) {
    if (type === 'dm' || type === 'groupDm' || !groupId) continue;
    if (!botGroupIds.has(groupId)) missing.add(groupId);
  }
  return [...missing].sort();
}

function deliveryTarget(destination: AutomationDestination) {
  if (destination.kind === 'dm') return destination.ship;
  if (destination.kind === 'channel') return destination.nest;
  return undefined;
}

function sameDestination(a: AutomationDestination, b: AutomationDestination) {
  return a.kind === b.kind && deliveryTarget(a) === deliveryTarget(b);
}

function deliveryFor(
  destination: AutomationDestination
): StewardAutomationDelivery | undefined {
  const to = deliveryTarget(destination);
  return to ? { mode: 'announce', channel: 'tlon', to } : undefined;
}

export function isBudgetHeld(task: StewardAutomationTask) {
  return (
    task.enabled === false &&
    (task.description ?? '').startsWith(BUDGET_HOLD_PREFIX.trimEnd())
  );
}

export function taskStatus(task: StewardAutomationTask): AutomationTaskStatus {
  if (isBudgetHeld(task)) return 'held';
  return task.enabled === false ? 'paused' : 'active';
}

/** A task's description as a person wrote it, without the plugin's markers. */
function readableDescription(task: StewardAutomationTask) {
  const description = task.description ?? '';
  if (description.startsWith(ONBOARDING_SLOT_PREFIX)) return '';
  return description.startsWith(BUDGET_HOLD_PREFIX.trimEnd())
    ? description.slice(BUDGET_HOLD_PREFIX.trimEnd().length).trim()
    : description.trim();
}

export function taskTitle(task: StewardAutomationTask) {
  return task.name?.trim() || readableDescription(task) || 'Untitled task';
}

// The bot's edit mapper (steward-automation-edit.ts in the OpenClaw plugin)
// patches a payload by kind and takes these two. Any other kind, or none,
// comes back `invalid`, along with every other field saved beside it.
const PROMPT_KINDS = ['agentTurn', 'systemEvent'];

/** Whether the bot would accept a new prompt for this task. */
export function canEditPrompt(task: StewardAutomationTask) {
  return PROMPT_KINDS.includes(task.payload?.kind ?? '');
}

export function draftFromTask(
  task: StewardAutomationTask
): AutomationTaskDraft {
  return {
    name: task.name ?? '',
    prompt: task.payload?.message ?? '',
    schedule: parseEditableSchedule(task.schedule),
    destination: destinationFromDelivery(task.delivery),
  };
}

export function newTaskDraft(
  ownerShip: string,
  /** Where it posts, when the task is started from a place that implies one. */
  destination: AutomationDestination = { kind: 'dm', ship: ownerShip }
): AutomationTaskDraft {
  return {
    name: '',
    prompt: '',
    schedule: { days: [1, 2, 3, 4, 5], hour: 9, minute: 0 },
    destination,
  };
}

/** The tasks that post into one of these channels, by task id. */
export function tasksPostingTo(
  tasks: Record<string, StewardAutomationTask>,
  channelIds: ReadonlySet<string>
): Record<string, StewardAutomationTask> {
  return Object.fromEntries(
    Object.entries(tasks).filter(([, task]) => {
      const destination = destinationFromDelivery(task.delivery);
      return destination.kind === 'channel' && channelIds.has(destination.nest);
    })
  );
}

/**
 * The first of a group's channels a new task could post to, for a task
 * started from that group.
 */
export function firstDestinationIn(
  channels: Iterable<{ id: string; type: string; groupId?: string | null }>,
  delivery: BotDelivery
): AutomationDestination | undefined {
  for (const channel of channels) {
    const destination = destinationForChannel(channel, delivery);
    if (destination) return destination;
  }
  return undefined;
}

/** The first thing wrong with a draft, in words for the person editing it. */
export function validateDraft(
  draft: AutomationTaskDraft,
  {
    isNew,
    named = true,
  }: {
    isNew: boolean;
    /** Whether the saved task has a name. One the bot made without can stay so. */
    named?: boolean;
  }
): string | null {
  if ((isNew || named) && !draft.name.trim()) return 'Give the task a name.';
  if (isNew && !draft.prompt.trim()) return 'Say what the bot should do.';
  if (draft.schedule && draft.schedule.days.length === 0) {
    return 'Pick at least one day.';
  }
  if (isNew && !draft.schedule) return 'Pick a time.';
  if (isNew && !deliveryTarget(draft.destination)) {
    return 'Choose where the task posts.';
  }
  return null;
}

/**
 * The patch that takes `task` to `draft`: only the fields the person changed.
 * The host merges a patch per field, so anything left out keeps its value,
 * including what the mirror doesn't carry (model, fallbacks, failure alerts).
 * `description` is never sent: onboarding and budget holds both key on it.
 */
export function buildTaskUpdate(
  task: StewardAutomationTask,
  draft: AutomationTaskDraft
): StewardAutomationTaskInput | null {
  const original = draftFromTask(task);
  const patch: StewardAutomationTaskInput = {};
  const name = draft.name.trim();
  if (name !== original.name.trim()) {
    patch.name = name;
  }
  if (draft.prompt !== original.prompt && canEditPrompt(task)) {
    patch.payload = { kind: task.payload?.kind, message: draft.prompt };
  }
  if (draft.schedule && !sameSchedule(draft.schedule, original.schedule)) {
    const current = task.schedule?.kind === 'cron' ? task.schedule : undefined;
    patch.schedule = {
      kind: 'cron',
      expr: cronExpressionFor(draft.schedule),
      ...(current?.tz ? { tz: current.tz } : {}),
      ...(current?.staggerMs === undefined
        ? {}
        : { staggerMs: current.staggerMs }),
    };
  }
  if (!sameDestination(draft.destination, original.destination)) {
    const delivery = deliveryFor(draft.destination);
    if (delivery) patch.delivery = delivery;
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * A new task in the shape the bot's own onboarding uses: a fresh session
 * per run, started at once, with the reply announced to the destination.
 */
export function buildTaskCreate(
  draft: AutomationTaskDraft,
  { timezone }: { timezone?: string }
): StewardAutomationTaskInput {
  if (!draft.schedule) {
    throw new Error('a new task needs a schedule');
  }
  const delivery = deliveryFor(draft.destination);
  return {
    name: draft.name.trim(),
    enabled: true,
    schedule: {
      kind: 'cron',
      expr: cronExpressionFor(draft.schedule),
      ...(timezone ? { tz: timezone } : {}),
    },
    sessionTarget: 'isolated',
    wakeMode: 'now',
    payload: { kind: 'agentTurn', message: draft.prompt.trim() },
    ...(delivery ? { delivery } : {}),
  };
}

/** Fold a patch into a mirrored task the way the host does, one field deep. */
export function applyTaskPatch(
  task: StewardAutomationTask,
  patch: StewardAutomationTaskInput
): StewardAutomationTask {
  return {
    ...task,
    ...patch,
    ...(patch.payload
      ? { payload: { ...task.payload, ...patch.payload } }
      : {}),
    ...(patch.delivery
      ? { delivery: { ...task.delivery, ...patch.delivery } }
      : {}),
  };
}

/** Apply one fact from the automation feed to the cached mirror. */
export function applyAutomationUpdate(
  snapshot: AutomationSnapshot | undefined,
  update: StewardAutomationUpdate
): AutomationSnapshot {
  const tasks = snapshot?.tasks ?? {};
  if ('tasks' in update) {
    return { available: true, tasks: update.tasks };
  }
  if ('set' in update) {
    const { ship, id, task } = update.set;
    return {
      available: true,
      tasks: { ...tasks, [ship]: { ...tasks[ship], [id]: task } },
    };
  }
  if ('del' in update) {
    const { ship, id } = update.del;
    if (!tasks[ship]) return { available: true, tasks };
    const remaining = { ...tasks[ship] };
    delete remaining[id];
    return { available: true, tasks: { ...tasks, [ship]: remaining } };
  }
  const remaining = { ...tasks };
  delete remaining[update.gone.ship];
  return { available: true, tasks: remaining };
}

/**
 * The mirror once a create has been answered. The bot's own projection of
 * the new task can reach the feed before its answer does, and it is the
 * fuller of the two, with the fields the host adds, so it is kept.
 */
export function snapshotAfterCreate(
  snapshot: AutomationSnapshot | undefined,
  ship: string,
  id: string,
  task: StewardAutomationTask
): AutomationSnapshot {
  if (snapshot?.tasks[ship]?.[id]) return snapshot;
  return applyAutomationUpdate(snapshot, { set: { ship, id, task } });
}

/** The tasks a change to the mirror took away, each with its bot. */
export function tasksRemoved(
  before: AutomationSnapshot | undefined,
  after: AutomationSnapshot
): { ship: string; task: StewardAutomationTask }[] {
  return Object.entries(before?.tasks ?? {}).flatMap(([ship, tasks]) =>
    Object.entries(tasks)
      .filter(([id]) => !after.tasks[ship]?.[id])
      .map(([, task]) => ({ ship, task }))
  );
}

/**
 * Whether to show a way into a bot's scheduled tasks. A node without the
 * automation module answers 404, which hides it. A read that failed any
 * other way keeps it, so the list can offer a retry, even when an earlier
 * 404 is still cached. `whileLoading` says what to do before the first
 * answer.
 */
export function offersScheduledTasks(
  query: { data?: AutomationSnapshot; isError: boolean },
  { whileLoading }: { whileLoading: boolean }
) {
  if (query.isError) return true;
  return query.data ? query.data.available : whileLoading;
}

/**
 * What a finished read of the mirror leaves in the cache. For a moment after
 * an edit the mirror is behind what the cache was just told, so a read from
 * that moment is dropped; the feed brings whatever else it saw.
 */
export function snapshotAfterRead(
  read: AutomationSnapshot,
  cached: AutomationSnapshot | undefined,
  { editedMsAgo, settleMs }: { editedMsAgo: number; settleMs: number }
): AutomationSnapshot {
  return cached?.available && editedMsAgo < settleMs ? cached : read;
}

/**
 * Whether a mirrored task is what a create asked for, going by the parts the
 * editor sets. The bot adds fields of its own, so the two are never equal
 * outright.
 */
export function isTaskFromCreate(
  created: StewardAutomationTaskInput,
  task: StewardAutomationTask
) {
  const timing = (schedule?: StewardAutomationSchedule) =>
    schedule?.kind === 'cron'
      ? `${schedule.expr ?? ''}\n${schedule.tz ?? ''}`
      : undefined;
  return (
    created.name === task.name &&
    timing(created.schedule) !== undefined &&
    timing(created.schedule) === timing(task.schedule) &&
    created.payload?.message === task.payload?.message &&
    sameDestination(
      destinationFromDelivery(created.delivery),
      destinationFromDelivery(task.delivery)
    )
  );
}

/** What went wrong with an edit, for the person who made it. */
export function describeAutomationError(error: unknown): string {
  const errorType =
    error && typeof error === 'object' && 'errorType' in error
      ? String(error.errorType)
      : undefined;
  switch (errorType) {
    case 'harness-offline':
      return 'Your bot is offline. Try again once it is back.';
    case 'not-found':
      return 'This task no longer exists.';
    case 'not-authorized':
      return 'This bot does not take changes from you.';
    case 'invalid':
      return 'The bot did not accept this change.';
    case 'harness-error':
      return 'The bot could not apply this change.';
  }
  if (
    error instanceof Error &&
    error.name === 'StewardAutomationPendingError'
  ) {
    return 'The bot has not answered yet. The change may still apply.';
  }
  return 'Could not reach your bot. Check your connection and try again.';
}
