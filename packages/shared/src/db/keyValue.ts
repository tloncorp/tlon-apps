import type { StorageConfiguration } from '@tloncorp/api/client/upload';
import * as ub from '@tloncorp/api/urbit';
import type { AppThemeName } from '@tloncorp/api/urbit/settings';
import type {
  StorageCredentials,
  StorageService,
} from '@tloncorp/api/urbit/storage';

import type { Attachment } from '../domain';
import {
  NodeBootPhase,
  OnboardingFlow,
  SignupParams,
  WayfindingProgress,
} from '../domain';
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

export type TlonbotRevivalStage =
  | 'collecting'
  | 'settingUp'
  | 'group'
  | 'invite';

export type TlonbotRevivalSetup = Pick<
  SignupParams,
  'nickname' | 'notificationToken' | 'notificationLevel'
> & {
  pending: boolean;
  applied?: boolean;
  provisioningStarted?: boolean;
  stage?: TlonbotRevivalStage;
  botName?: string;
  botAvatarUrl?: string | null;
  botAvatarUploadIntent?: Attachment.UploadIntent | null;
  botProvider?: string;
  botModel?: string;
};

export const tlonbotRevivalSetup = createStorageItem<TlonbotRevivalSetup>({
  key: 'tlonbotRevivalSetup',
  defaultValue: {
    pending: false,
  },
});

export type TlonbotRevivalDeferredConfig = {
  profileNickname?: string;
  notificationToken?: string;
  notificationLevel?: ub.NotificationLevel;
  botName?: string;
  botAvatarUrl?: string | null;
  botAvatarUploadIntent?: Attachment.UploadIntent | null;
  botProvider?: string;
  botModel?: string;
};

export const tlonbotRevivalDeferredConfig =
  createStorageItem<TlonbotRevivalDeferredConfig>({
    key: 'tlonbotRevivalDeferredConfig',
    defaultValue: {},
  });

export const didClearPreviousInstall = createStorageItem<boolean>({
  key: 'didClearPreviousInstall',
  defaultValue: false,
  persistAfterLogout: true,
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

export const webAppSplashOpenCount = createStorageItem<number>({
  key: 'webAppSplashOpenCount',
  defaultValue: 0,
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

export const homeGroupInviteLink = createStorageItem<string | null>({
  key: 'homeGroupInviteLink',
  defaultValue: null,
});

export const hasViewedPersonalInvite = createStorageItem<boolean>({
  key: 'hasViewedPersonalInvite',
  defaultValue: false,
});

export const postDraft = (opts: {
  key: string;
  type: 'caption' | 'link' | 'text' | undefined; // matches GalleryDraftType
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

export type NotesNoteDraft = {
  title: string;
  body: string;
  baseRevision: number;
  stashedAt: number;
};

/** Crash insurance for the notes editor: drafts stashed between autosave
 * cycles, keyed by `${notebookFlag}/${noteId}`. Cleared once saved. */
export const notesNoteDrafts = createStorageItem<
  Record<string, NotesNoteDraft>
>({
  key: 'notesNoteDrafts',
  defaultValue: {},
});

export const invitation = createStorageItem<Lure | null>({
  key: 'lure',
  defaultValue: null,
});

// deferred install attribution (referrer/clipboard/ip match) runs exactly
// once per install; this flag survives relaunches but not reinstalls
export const deferredInviteChecked = createStorageItem<boolean>({
  key: 'deferredInviteChecked',
  defaultValue: false,
  // one shot per INSTALL, not per session: without this, logout re-arms
  // the cascade and the old referrer/clipboard/ip match would attach the
  // original install's invite to the next account
  persistAfterLogout: true,
});

export type ShipInfo = {
  authType: 'self' | 'hosted';
  ship: string | undefined;
  shipUrl: string | undefined;
  authCookie: string | undefined;
  needsSplashSequence?: boolean;
  splashSequenceMode?: OnboardingFlow;
};

export const shipInfo = createStorageItem<ShipInfo | null>({
  key: 'store',
  defaultValue: null,
});

export const featureFlags = createStorageItem<any>({
  key: 'featureFlags',
  defaultValue: null,
});

export const contextLensGatewayUrl = createStorageItem<string | null>({
  key: 'contextLensGatewayUrl',
  defaultValue: null,
});

export const contextLensGatewayToken = createStorageItem<string | null>({
  key: 'contextLensGatewayToken',
  defaultValue: null,
  isSecure: true,
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

export const splashNickname = createStorageItem<string>({
  key: 'splashNickname',
  defaultValue: '',
});

export const wayfindingProgress = createStorageItem<WayfindingProgress>({
  key: 'wayfindingProgress',
  defaultValue: {
    viewedPersonalGroup: false,
    viewedChatChannel: false,
    viewedCollectionChannel: false,
    viewedNotebookChannel: false,
    tappedHomeAdd: true,
    tappedAddNote: true,
    tappedAddCollection: true,
    tappedChatInput: true,
    tappedHomeGroupHint: true,
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

/**
 * How many times the user has reacted with each native emoji glyph, used to
 * surface their most-used emoji in the quick reaction toolbar. Local-only —
 * usage is never synced to the ship.
 */
export type EmojiUsage = Record<string, { count: number; lastUsedAt: number }>;

/** Cap on tracked emoji, so a long tail of one-offs can't grow without bound. */
export const MAX_TRACKED_EMOJIS = 100;

export const emojiUsage = createStorageItem<EmojiUsage>({
  key: 'emojiUsage',
  defaultValue: {},
});

/** Records one use of `emoji`, evicting the least-used glyph if over the cap. */
export function applyEmojiUsage(
  current: EmojiUsage,
  emoji: string,
  usedAt: number
): EmojiUsage {
  const next = {
    ...current,
    [emoji]: {
      count: (current[emoji]?.count ?? 0) + 1,
      lastUsedAt: usedAt,
    },
  };
  if (Object.keys(next).length <= MAX_TRACKED_EMOJIS) {
    return next;
  }
  // Evict from the rest, never the emoji just used. Ranking the new entry
  // against a full set would drop it at count 1 on every press, so a newly
  // favored emoji could never accumulate enough usage to earn a slot.
  const kept = sortEmojisByUsage(next)
    .filter((key) => key !== emoji)
    .slice(0, MAX_TRACKED_EMOJIS - 1);
  return Object.fromEntries([...kept, emoji].map((key) => [key, next[key]]));
}

export async function recordEmojiUsage(emoji: string, usedAt: number) {
  return emojiUsage.setValue((current) =>
    applyEmojiUsage(current, emoji, usedAt)
  );
}

/** Emoji glyphs ordered by use count, ties broken by most recently used. */
export function sortEmojisByUsage(usage: EmojiUsage): string[] {
  return Object.keys(usage).sort((a, b) => {
    const countDiff = usage[b].count - usage[a].count;
    return countDiff !== 0
      ? countDiff
      : usage[b].lastUsedAt - usage[a].lastUsedAt;
  });
}

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

/**
 * How far background workspace provisioning has got.
 *
 * Deliberately client-side rather than in the group's blob descriptor. The
 * descriptor's `setup` field means "has the kit's setup conversation run" —
 * the agent's lifecycle, not the provisioner's — and it cannot express
 * "failed but recoverable" without conflating the two. Provisioning progress
 * also has to survive the app being killed mid-flow, which is what a durable
 * storage item is for.
 *
 * `name` is the load-bearing field: the group flag is `${our}/${name}`, so
 * recording the name before poking is what lets a relaunch tell "the install
 * landed" from "the install never happened".
 */
export type WorkspaceProvisioningState = {
  status: 'idle' | 'running' | 'failed' | 'done';
  kitId: string | null;
  name: string | null;
  groupId: string | null;
  /** Why the last attempt gave up. Only meaningful when status is 'failed'. */
  error?: string;
};

export const workspaceProvisioning =
  createStorageItem<WorkspaceProvisioningState>({
    key: 'workspaceProvisioning',
    defaultValue: {
      status: 'idle',
      kitId: null,
      name: null,
      groupId: null,
    },
  });

/**
 * Where onboarding wants to drop the user once their workspace is reachable.
 *
 * A durable handoff rather than a navigation call, because the channel is
 * created by a ship-side kit install and the local row trails sync — so
 * "navigate when the last pane completes" would land on a screen for a channel
 * the database has never heard of. The consumer waits for the row, navigates,
 * and clears this.
 *
 * Cleared on consumption, so it is a one-shot: a user who navigates away is
 * not dragged back on the next launch.
 *
 * `channelId` is null when onboarding finished before the group row (whose
 * kit blob names the conversation) had synced — the consumer resolves it from
 * the group once that lands, so a fast user still gets dropped into the
 * workspace instead of the chat list.
 */
export type WorkspaceLanding = {
  groupId: string;
  channelId: string | null;
} | null;

export const workspaceLanding = createStorageItem<WorkspaceLanding>({
  key: 'workspaceLanding',
  defaultValue: null,
});
