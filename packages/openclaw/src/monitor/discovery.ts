import type { RuntimeEnv } from 'openclaw/plugin-sdk/runtime';

import type { Foreigns } from '../urbit/foreigns.js';
import { formatChangesDate } from './utils.js';

export async function fetchGroupChanges(
  api: { scry: (path: string) => Promise<unknown> },
  runtime: RuntimeEnv,
  daysAgo = 5
) {
  try {
    const changeDate = formatChangesDate(daysAgo);
    runtime.log?.(
      `[tlon] Fetching group changes since ${daysAgo} days ago (${changeDate})...`
    );
    const changes = await api.scry(`/groups-ui/v8/changes/${changeDate}.json`);
    if (changes) {
      runtime.log?.('[tlon] Successfully fetched changes data');
      return changes;
    }
    return null;
  } catch (error: any) {
    runtime.log?.(
      `[tlon] Failed to fetch changes (falling back to full init): ${error?.message ?? String(error)}`
    );
    return null;
  }
}

export interface InitData {
  channels: string[];
  channelToGroup: Map<string, string>;
  /** Map from group flag to human-readable group title */
  groupNames: Map<string, string>;
  foreigns: Foreigns | null;
}

/**
 * Fetch groups-ui init data, returning channels and foreigns.
 * This is a single scry that provides both channel discovery and pending invites.
 */
export async function fetchInitData(
  api: { scry: (path: string) => Promise<unknown> },
  runtime: RuntimeEnv
): Promise<InitData> {
  try {
    runtime.log?.('[tlon] Fetching groups-ui init data...');
    const initData = (await api.scry('/groups-ui/v7/init.json')) as any;

    const channels: string[] = [];
    const channelToGroup = new Map<string, string>();
    const groupNames = new Map<string, string>();
    if (initData?.groups) {
      for (const [groupFlag, groupData] of Object.entries(
        initData.groups as Record<string, any>
      )) {
        if (groupData && typeof groupData === 'object') {
          // Extract group title from metadata
          const title = groupData.meta?.title;
          if (title && typeof title === 'string') {
            groupNames.set(groupFlag, title);
          }
          if (groupData.channels) {
            for (const channelNest of Object.keys(groupData.channels)) {
              if (
                channelNest.startsWith('chat/') ||
                channelNest.startsWith('heap/') ||
                channelNest.startsWith('diary/')
              ) {
                channels.push(channelNest);
                channelToGroup.set(channelNest, groupFlag);
              }
            }
          }
        }
      }
    }

    if (channels.length > 0) {
      runtime.log?.(`[tlon] Auto-discovered ${channels.length} channel(s)`);
    } else {
      runtime.log?.('[tlon] No channels found via auto-discovery');
    }

    const foreigns = (initData?.foreigns as Foreigns) || null;
    if (foreigns) {
      const pendingCount = Object.values(foreigns).filter((f) =>
        f.invites?.some((i) => i.valid)
      ).length;
      if (pendingCount > 0) {
        runtime.log?.(`[tlon] Found ${pendingCount} pending group invite(s)`);
      }
    }

    return { channels, channelToGroup, groupNames, foreigns };
  } catch (error: any) {
    runtime.log?.(
      `[tlon] Init data fetch failed: ${error?.message ?? String(error)}`
    );
    return {
      channels: [],
      channelToGroup: new Map(),
      groupNames: new Map(),
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
