import type { RuntimeEnv } from 'openclaw/plugin-sdk/runtime';

import type { Foreigns } from '../urbit/foreigns.js';
import { formatChangesDate } from './utils.js';
import { stringList } from './group-channels.js';

export async function fetchGroupChanges(
  api: { scry: (path: string) => Promise<unknown> },
  runtime: RuntimeEnv,
  daysAgo = 5
) {
  try {
    const changeDate = formatChangesDate(daysAgo);
    const changes = await api.scry(`/groups-ui/v8/changes/${changeDate}.json`);
    return changes || null;
  } catch (error: any) {
    runtime.error?.(
      `[tlon] Failed to fetch changes (falling back to full init): ${error?.message ?? String(error)}`
    );
    return null;
  }
}

export interface InitData {
  channels: string[];
  channelToGroup: Map<string, string>;
  /** Map from channel nest to reader role ids (empty = all members) */
  channelReaders: Map<string, string[]>;
  /**
   * Per group: member ship -> role ids, for audience checks. Groups whose
   * seat map exceeds the capture cap are marked 'too-large' so lookups
   * fail closed instead of loading an unbounded map.
   */
  groupSeats: Map<string, Map<string, string[]> | 'too-large'>;
  /** Map from channel nest to human-readable channel title */
  channelNames: Map<string, string>;
  /** Map from group flag to human-readable group title */
  groupNames: Map<string, string>;
  /**
   * Per group: the bot's roles (its seat's `roles`) and the admin roles
   * (`admins`), for the channel readability filter. Empty unless `botShip`
   * was given, and absent for a group where the bot has no seat.
   */
  groupRoles: Map<string, { botSects: string[]; bloc: string[] }>;
  foreigns: Foreigns | null;
}

/**
 * Extract reader role ids from a groups-ui channel record. Unparseable
 * shapes yield a non-empty sentinel so downstream audience checks fail
 * closed (a channel we can't read permissions for is treated as
 * restricted, never as open).
 */
function extractReaderRoles(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return ['__unknown__'];
  }
  const readers = (value as { readers?: unknown }).readers;
  if (readers === undefined || readers === null) {
    return ['__unknown__'];
  }
  if (!Array.isArray(readers)) {
    return ['__unknown__'];
  }
  return readers.filter((role): role is string => typeof role === 'string');
}

/**
 * Extract the full seats map (ship -> role ids) from a groups-ui group
 * record. Groups above the cap return 'too-large' so per-ship audience
 * lookups fail closed instead of holding an unbounded map in memory.
 * A missing/unparseable seats field returns an EMPTY map: nobody resolves
 * as a member, which is the closed direction.
 */
const MAX_CAPTURED_SEATS = 5_000;

function extractGroupSeats(
  value: unknown
): Map<string, string[]> | 'too-large' {
  const seats = new Map<string, string[]>();
  if (!value || typeof value !== 'object') {
    return seats;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_CAPTURED_SEATS) {
    return 'too-large';
  }
  for (const [ship, seat] of entries) {
    if (seat && typeof seat === 'object') {
      seats.set(ship, stringList((seat as { roles?: unknown }).roles));
    }
  }
  return seats;
}

function extractTitle(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const metadata = value as {
    meta?: { title?: unknown };
    title?: unknown;
  };
  const title = metadata.meta?.title ?? metadata.title;
  return typeof title === 'string' && title.trim() ? title.trim() : undefined;
}

/**
 * Fetch groups-ui init data, returning channels, per-group roles and foreigns.
 * This is a single scry that provides both channel discovery and pending invites.
 */
export async function fetchInitData(
  api: {
    scry: (
      path: string,
      options?: { signal?: AbortSignal }
    ) => Promise<unknown>;
  },
  runtime: RuntimeEnv,
  options?: { signal?: AbortSignal; botShip?: string }
): Promise<InitData> {
  try {
    const initData = (await api.scry('/groups-ui/v7/init.json', {
      signal: options?.signal,
    })) as any;

    const channels: string[] = [];
    const channelToGroup = new Map<string, string>();
    const channelReaders = new Map<string, string[]>();
    const groupSeats = new Map<string, Map<string, string[]> | 'too-large'>();
    const channelNames = new Map<string, string>();
    const groupNames = new Map<string, string>();
    const groupRoles = new Map<
      string,
      { botSects: string[]; bloc: string[] }
    >();
    if (initData?.groups) {
      for (const [groupFlag, groupData] of Object.entries(
        initData.groups as Record<string, any>
      )) {
        if (groupData && typeof groupData === 'object') {
          // Extract group title from metadata
          const title = extractTitle(groupData);
          if (title) {
            groupNames.set(groupFlag, title);
          }
          groupSeats.set(groupFlag, extractGroupSeats(groupData.seats));
          if (options?.botShip) {
            const seat = groupData.seats?.[options.botShip];
            if (seat && typeof seat === 'object') {
              groupRoles.set(groupFlag, {
                botSects: stringList(seat.roles),
                bloc: stringList(groupData.admins),
              });
            }
          }
          if (groupData.channels) {
            for (const [channelNest, channelData] of Object.entries(
              groupData.channels
            )) {
              if (
                channelNest.startsWith('chat/') ||
                channelNest.startsWith('heap/') ||
                channelNest.startsWith('diary/')
              ) {
                channels.push(channelNest);
                channelToGroup.set(channelNest, groupFlag);
                channelReaders.set(
                  channelNest,
                  extractReaderRoles(channelData)
                );
                const channelTitle = extractTitle(channelData);
                if (channelTitle) {
                  channelNames.set(channelNest, channelTitle);
                }
              }
            }
          }
        }
      }
    }

    const foreigns = (initData?.foreigns as Foreigns) || null;

    return {
      channels,
      channelToGroup,
      channelReaders,
      groupSeats,
      channelNames,
      groupNames,
      groupRoles,
      foreigns,
    };
  } catch (error: any) {
    if (
      options?.signal?.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      throw options?.signal?.reason ?? error;
    }
    runtime.error?.(
      `[tlon] Init data fetch failed: ${error?.message ?? String(error)}`
    );
    return {
      channels: [],
      channelToGroup: new Map(),
      channelReaders: new Map(),
      groupSeats: new Map(),
      channelNames: new Map(),
      groupNames: new Map(),
      groupRoles: new Map(),
      foreigns: null,
    };
  }
}

export async function fetchAllChannels(
  api: { scry: (path: string) => Promise<unknown> },
  runtime: RuntimeEnv
): Promise<string[]> {
  const { channels } = await fetchInitData(api, runtime);
  return channels;
}
