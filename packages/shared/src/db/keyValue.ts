import { ThemeName } from 'tamagui';

import {
  StorageConfiguration,
  StorageCredentials,
  StorageService,
} from '../api';
import { NodeBootPhase, SignupParams, WayfindingProgress } from '../domain';
import { Lure } from '../logic';
import * as ub from '../urbit';
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

export const themeSettings = createStorageItem<ThemeName | null>({
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

export const lastEventReceivedAt = createStorageItem<number>({
  key: 'lastEventReceivedAt',
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

export const didDismissSystemContactsPrompt = createStorageItem<boolean>({
  key: 'didDismissSystemContactsPrompt',
  defaultValue: false,
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
