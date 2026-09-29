/**
 * Shared index of group structure for memory features: which group each
 * channel belongs to, each channel's reader roles, and display titles.
 *
 * Populated by the monitor from groups-ui init data (the same fetch that
 * drives channel auto-discovery). The channel→group relation is immutable
 * on the backend — channels never move between groups — so entries are
 * only ever added or refreshed, never re-parented. Reader sets DO change
 * at runtime, so consumers must treat them as a snapshot, not a fact.
 */
import { sharedMap } from '../shared-state.js';

export interface ChannelIndexEntry {
  groupFlag: string;
  /** Reader role ids; empty array means readable by every group member. */
  readers: string[];
  title?: string;
}

export interface GroupIndexEntry {
  title?: string;
  /** Nests in this group, in discovery order. */
  channels: string[];
}

const channelIndex = sharedMap<string, ChannelIndexEntry>(
  'memory-channel-index'
);
const groupIndex = sharedMap<string, GroupIndexEntry>('memory-group-index');

/**
 * Per-group member seats (ship -> role ids). 'too-large' marks a group whose
 * seat map exceeded the capture cap; per-ship lookups there return undefined
 * so audience checks fail closed rather than guessing.
 */
const groupSeats = sharedMap<string, Map<string, string[]> | 'too-large'>(
  'memory-group-seats'
);

export function updateGroupIndex(params: {
  channelToGroup: ReadonlyMap<string, string>;
  channelReaders?: ReadonlyMap<string, string[]>;
  channelNames?: ReadonlyMap<string, string>;
  groupNames?: ReadonlyMap<string, string>;
  groupSeats?: ReadonlyMap<string, ReadonlyMap<string, string[]> | 'too-large'>;
}): void {
  if (params.groupSeats) {
    for (const [groupFlag, seats] of params.groupSeats) {
      groupSeats.set(
        groupFlag,
        seats === 'too-large' ? 'too-large' : new Map(seats)
      );
    }
  }
  const grouped = new Map<string, string[]>();
  for (const [nest, groupFlag] of params.channelToGroup) {
    channelIndex.set(nest, {
      groupFlag,
      readers: params.channelReaders?.get(nest) ?? [],
      ...(params.channelNames?.get(nest)
        ? { title: params.channelNames.get(nest) }
        : {}),
    });
    const list = grouped.get(groupFlag) ?? [];
    list.push(nest);
    grouped.set(groupFlag, list);
  }
  for (const [groupFlag, channels] of grouped) {
    groupIndex.set(groupFlag, {
      channels,
      ...(params.groupNames?.get(groupFlag)
        ? { title: params.groupNames.get(groupFlag) }
        : {}),
    });
  }
}

export function getChannelIndexEntry(
  nest: string
): ChannelIndexEntry | undefined {
  return channelIndex.get(nest);
}

export function getGroupIndexEntry(
  groupFlag: string
): GroupIndexEntry | undefined {
  return groupIndex.get(groupFlag);
}

/**
 * Role ids a ship holds in a group, or undefined when unknown (not a member,
 * seats not captured, or the group's seat map exceeded the capture cap).
 * Callers must treat undefined as "cannot read" — never as "member with no
 * roles" (that is an empty array).
 */
export function getSeatRoles(
  groupFlag: string,
  ship: string
): string[] | undefined {
  const seats = groupSeats.get(groupFlag);
  if (!seats || seats === 'too-large') {
    return undefined;
  }
  return seats.get(ship);
}

/** All group flags currently indexed (discovery order not guaranteed). */
export function listIndexedGroupFlags(): string[] {
  return [...groupIndex.keys()];
}

/** Test helper: reset shared state between tests. */
export function clearGroupIndexForTest(): void {
  channelIndex.clear();
  groupIndex.clear();
  groupSeats.clear();
}
