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
  /** Map from channel nest to human-readable channel title */
  channelNames: Map<string, string>;
  /** Map from group flag to human-readable group title */
  groupNames: Map<string, string>;
  foreigns: Foreigns | null;
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
 * Fetch groups-ui init data, returning channels and foreigns.
 * This is a single scry that provides both channel discovery and pending invites.
 */
export async function fetchInitData(
  api: { scry: (path: string) => Promise<unknown> },
  runtime: RuntimeEnv
): Promise<InitData> {
  try {
    const initData = (await api.scry('/groups-ui/v7/init.json')) as any;

    const channels: string[] = [];
    const channelToGroup = new Map<string, string>();
    const channelNames = new Map<string, string>();
    const groupNames = new Map<string, string>();
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

    return { channels, channelToGroup, channelNames, groupNames, foreigns };
  } catch (error: any) {
    runtime.error?.(
      `[tlon] Init data fetch failed: ${error?.message ?? String(error)}`
    );
    return {
      channels: [],
      channelToGroup: new Map(),
      channelNames: new Map(),
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
