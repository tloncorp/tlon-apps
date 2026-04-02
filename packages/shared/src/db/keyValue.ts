import { AppThemeName, StorageConfiguration } from '@tloncorp/api';
import type { StorageCredentials, StorageService } from '@tloncorp/api/urbit';
import * as ub from '@tloncorp/api/urbit';

import { NodeBootPhase, SignupParams, WayfindingProgress } from '../domain';
import { Lure } from '../logic';
import { createStorageItem } from './storageItem';

export const pushNotificationSettings =
  createStorageItem<ub.PushNotificationsSetting>({
    key: 'settings:pushNotifications',
    defaultValue: 'none',
  });

export const isTlonEmployee = createStorageItem<boolean>({
  key: 'isTlonEmployee',
  defaultValue: false,
});

export const STORAGE_SETTINGS_QUERY_KEY = ['storageSettings'];

export const dismissedPinnedPostBannerIds = createStorageItem<string[]>({
  key: 'dismissedPinnedPostBannerIds',
  defaultValue: [],
});

export const storageConfiguration =
  createStorageItem<StorageConfiguration | null>({
    key: 'storageConfiguration',
    queryKey: STORAGE_SETTINGS_QUERY_KEY,
    defaultValue: null,
  });

export async function updateStorageConfiguration(
  update: Partial<StorageConfiguration>
) {
  const current = await storageConfiguration.getValue();
  if (!current) {
    return;
  }
  return storageConfiguration.setValue({ ...current, ...update });
}

export async function addStorageBucket(bucket: string) {
  const current = await storageConfiguration.getValue();
  if (!current) {
    return;
  }
  if (current.buckets.includes(bucket)) {
    return;
  }
  current.buckets.push(bucket);
  return storageConfiguration.setValue(current);
}

export async function removeStorageBucket(bucket: string) {
  const current = await storageConfiguration.getValue();
  if (!current) {
    return;
  }
  current.buckets = current.buckets.filter((b) => b !== bucket);
  return storageConfiguration.setValue(current);
}

export async function toggleStorageService(service: StorageService) {
  const current = await storageConfiguration.getValue();
  if (!current) {
    return;
  }
  return storageConfiguration.setValue({ ...current, service });
}

export const storageCredentials = createStorageItem<StorageCredentials | null>({
  key: 'storageCredentials',
  defaultValue: null,
  queryKey: STORAGE_SETTINGS_QUERY_KEY,
});

export async function updateStorageCredentials(
  update: Partial<StorageCredentials>
) {
  const current = await storageCredentials.getValue();
  if (!current) {
    return;
  }
  await storageCredentials.setValue({ ...current, ...update });
}

export type AppInfo = {
  groupsVersion: string;
  groupsHash: string;
  groupsSyncNode: string;
};

export const appInfo = createStorageItem<AppInfo | null>({
  key: 'settings:appInfo',
  defaultValue: null,
});

export const benefitsSheetDismissed = createStorageItem<boolean>({
  key: 'didShowBenefitsSheet',
  defaultValue: false,
  persistAfterLogout: true,
});

export const signupData = createStorageItem<SignupParams>({
  key: 'signupData',
  defaultValue: {
    reservedNodeId: null,
    bootPhase: NodeBootPhase.IDLE,
  },
});

export const lastAppVersion = createStorageItem<string | null>({
  key: 'lastAppVersion',
  defaultValue: null,
  persistAfterLogout: true,
});

export const didSignUp = createStorageItem<boolean>({
  key: 'didSignUp',
  defaultValue: false,
  persistAfterLogout: true,
});

export const didInitializeTelemetry = createStorageItem<boolean>({
  key: 'confirmedAnalyticsOptOut',
  defaultValue: false,
});

export const hasClearedLegacyWebTelemetry = createStorageItem<boolean>({
  key: 'hasClearedLegacyWebTelemetry',
  defaultValue: false,
});

export const lastAnonymousAppOpenAt = createStorageItem<number | null>({
  key: 'lastAnonymousAppOpenAt',
  defaultValue: null,
});

export const finishingSelfHostedLogin = createStorageItem<boolean>({
  key: 'finishingSelfHostedLogin',
  defaultValue: false,
});

export const groupsUsedForSuggestions = createStorageItem<string[]>({
  key: 'groupsUsedForSuggestions',
  defaultValue: [],
});

export const lastAddedSuggestionsAt = createStorageItem<number>({
  key: 'lastAddedSuggestionsAt',
  defaultValue: 0,
});

export const personalInviteLink = createStorageItem<string | null>({
  key: 'personalInviteLink',
  defaultValue: null,
});

export const hasViewedPersonalInvite = createStorageItem<boolean>({
  key: 'hasViewedPersonalInvite',
  defaultValue: false,
});

export const postDraft = (opts: {
  key: string;
  type: 'caption' | 'text' | undefined; // matches GalleryDraftType
}) => {
  return createStorageItem<ub.JSONContent | null>({
    key: `draft-${opts.key}${opts.type ? `-${opts.type}` : ''}`,
    defaultValue: null,
  });
};

export const lastVisitedChannelId = (groupId: string) => {
  return createStorageItem<string | null>({
    key: `lastVisitedChannelId-${groupId}`,
    defaultValue: null,
  });
};

export const themeSettings = createStorageItem<AppThemeName | null>({
  key: '@user_theme',
  defaultValue: null,
});

export type ChannelSortPreference = 'recency' | 'arranged';

export const channelSortPreference = createStorageItem<ChannelSortPreference>({
  key: 'channelSortPreference',
  defaultValue: 'recency',
});

export const invitation = createStorageItem<Lure | null>({
  key: 'lure',
  defaultValue: null,
});

export type ShipInfo = {
  authType: 'self' | 'hosted';
  ship: string | undefined;
  shipUrl: string | undefined;
  authCookie: string | undefined;
  needsSplashSequence?: boolean;
};

export const shipInfo = createStorageItem<ShipInfo | null>({
  key: 'store',
  defaultValue: null,
});

export const featureFlags = createStorageItem<any>({
  key: 'featureFlags',
  defaultValue: null,
});

export const eulaAgreed = createStorageItem<boolean>({
  key: 'eula',
  defaultValue: false,
});

export const splashDismissed = createStorageItem<boolean>({
  key: 'splash',
  defaultValue: false,
});

export const haveHostedLogin = createStorageItem<boolean>({
  key: 'haveHostedLogin',
  defaultValue: false,
});

export const hostedUserNodeId = createStorageItem<string | null>({
  key: 'hostedUserNodeId',
  defaultValue: null,
});

export const hostedAccountIsInitialized = createStorageItem<boolean>({
  key: 'hostedAccountIsInitialized',
  defaultValue: false,
});

export const hostedNodeIsRunning = createStorageItem<boolean>({
  key: 'hostedNodeIsRunning',
  defaultValue: false,
});

export const hostingAuthExpired = createStorageItem<boolean>({
  key: 'hosting:hostingAuthExpired',
  defaultValue: false,
});

export const hostingLastAuthCheck = createStorageItem<number>({
  key: 'hosting:lastAuthCheck',
  defaultValue: 0,
});

export const hostingAuthToken = createStorageItem<string>({
  key: 'hostingToken',
  defaultValue: '',
  isSecure: true,
});

export const hostingUserId = createStorageItem<string>({
  key: 'hostingUserId',
  defaultValue: '',
  isSecure: true,
});

export const hostingBotEnabled = createStorageItem<boolean>({
  key: 'hostingBotEnabled',
  defaultValue: false,
});

export const nodeAccessCode = createStorageItem<string | null>({
  key: 'nodeAccessCode',
  defaultValue: null,
  isSecure: true,
});

export const nodeStoppedWhileLoggedIn = createStorageItem<boolean>({
  key: 'nodeStoppedWhileLoggedIn',
  defaultValue: false,
});

export const headsSyncedAt = createStorageItem<number>({
  key: 'headsSyncedAt',
  defaultValue: 0,
});

export const CHANGES_SYNCED_AT_KEY = 'changesSyncedAt';
export const changesSyncedAt = createStorageItem<number | null>({
  key: CHANGES_SYNCED_AT_KEY,
  defaultValue: null,
});

export const lastActivityAt = createStorageItem<number>({
  key: 'lastActivityAt',
  defaultValue: 0,
});

export const anyalticsDigestUpdatedAt = createStorageItem<number | null>({
  key: 'analyticsDigestUpdatedAt',
  defaultValue: null,
});

export const userHasCompletedFirstSync = createStorageItem<boolean>({
  key: 'userHasCompletedFirstSync',
  defaultValue: false,
});

export const userHasPersonalGroup = createStorageItem<boolean>({
  key: 'userHasPersonalGroup',
  defaultValue: false,
});

export const wayfindingProgress = createStorageItem<WayfindingProgress>({
  key: 'wayfindingProgress',
  defaultValue: {
    viewedPersonalGroup: false,
    viewedChatChannel: false,
    viewedCollectionChannel: false,
    viewedNotebookChannel: false,
    tappedAddNote: true,
    tappedAddCollection: true,
    tappedChatInput: true,
  },
});

export const lastLanyardSalt = createStorageItem<string | null>({
  key: 'lastLanyardSalt',
  defaultValue: null,
  persistAfterLogout: false,
});

export const lastPhoneContactSetRequest = createStorageItem<string | null>({
  key: 'lastPhoneContactSetRequest',
  defaultValue: null,
  persistAfterLogout: false,
});

export const debugMessageJson = createStorageItem<boolean>({
  key: 'debugMessageJson',
  defaultValue: false,
  persistAfterLogout: false,
});

export const debugPermittedSchedulerId = createStorageItem<string | null>({
  key: 'debugPermittedSchedulerId',
  defaultValue: null,
  persistAfterLogout: true,
});

export const didSyncInitialPosts = createStorageItem<boolean>({
  key: 'didSyncInitialPosts',
  defaultValue: false,
  persistAfterLogout: false,
});

export const sqliteContent = createStorageItem<ArrayBuffer | null>({
  key: 'sqliteContent',
  defaultValue: null,
  persistAfterLogout: false,
  serialize: (value) => (value == null ? '' : arrayBufferToString(value)),
  deserialize: (str) => (str.length === 0 ? null : stringToArrayBuffer(str)),
  isLarge: true,
});

/**
 * Contains locale codes (e.g. `en-US`) that we've already prompted the user to
 * download for offline use, so we don't repeatedly nag them about it.
 */
export const alreadyPromptedLocaleDownloads = createStorageItem<Set<string>>({
  key: 'alreadyPromptedLocaleDownloads',
  defaultValue: new Set(),
  serialize: (value) => JSON.stringify(Array.from(value)),
  deserialize: (str) => new Set(JSON.parse(str)),
});

function stringToArrayBuffer(str: string) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function arrayBufferToString(buf: ArrayBuffer) {
  const uint8s = new Uint8Array(buf);
  const chars = Array.from(uint8s, (byte) => String.fromCharCode(byte));
  return chars.join('');
}

export type NagState = {
  lastDismissed: number;
  dismissCount: number;
  eliminated: boolean;
  firstEligibleTime: number;
};

const defaultNagState: NagState = {
  lastDismissed: 0,
  dismissCount: 0,
  eliminated: false,
  firstEligibleTime: 0,
};

// Cache nag storage items to avoid creating new instances on every render
// This prevents race conditions from multiple updateLock instances
const nagStorageItemCache = new Map<
  string,
  ReturnType<typeof createStorageItem<NagState>>
>();

export const createNagStorageItem = (
  key: string,
  persistAfterLogout = true
) => {
  const cached = nagStorageItemCache.get(key);
  if (cached) {
    return cached;
  }

  const storageItem = createStorageItem<NagState>({
    key: `nag:${key}`,
    defaultValue: defaultNagState,
    persistAfterLogout,
  });

  nagStorageItemCache.set(key, storageItem);
  return storageItem;
};
