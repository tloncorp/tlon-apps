import * as db from '../db';
import * as ub from '../urbit';
import { poke, scry, subscribe } from './urbit';

const PENDING_MEMBER_DISMISSAL_PREFIX = 'pendingMemberDismissal:';
export function getPendingMemberDismissalKey(groupId: string) {
  return `${PENDING_MEMBER_DISMISSAL_PREFIX}${groupId}`;
}

export function getMessagesFilter(
  value: string | null | undefined
): ub.TalkSidebarFilter {
  if (!value) {
    return 'Direct Messages';
  }

  switch (value) {
    case 'Direct Messages':
    case 'All Messages':
    case 'Group Channels':
      return value;
    default:
      throw new Error(`Invalid messages filter: ${value}`);
  }
}

function getBucket(key: string): string {
  if (key.startsWith(PENDING_MEMBER_DISMISSAL_PREFIX)) {
    return 'groups';
  }

  switch (key) {
    case 'messagesFilter':
      return 'talk';
    case 'activitySeenTimestamp':
    case 'completedWayfindingSplash':
    case 'completedWayfindingTutorial':
    case 'disableTlonInfraEnhancement':
    case 'enableTelemetry':
      return 'groups';
    case 'disableAvatars':
    case 'disableNicknames':
    case 'disableRemoteContent':
    case 'disableAppTileUnreads':
    case 'disableSpellcheck':
    case 'showUnreadCounts':
      return 'calmEngine';
    case 'theme':
      return 'display';
    default:
      console.warn(
        `No explicit bucket defined for setting key: ${key}, defaulting to 'groups'`
      );
      return 'groups';
  }
}

export const setSetting = async (key: string, val: any) => {
  return poke({
    app: 'settings',
    mark: 'settings-event',
    json: {
      'put-entry': {
        desk: 'groups',
        'bucket-key': getBucket(key),
        'entry-key': key,
        value: val,
      },
    },
  });
};

export const getSettings = async (): Promise<{
  settings: db.Settings;
  pendingMemberDismissals: db.PendingMemberDismissals;
}> => {
  const results = await scry<ub.GroupsDeskSettings>({
    app: 'settings',
    path: '/desk/groups',
  });

  const settings = toClientSettings(results);
  const pendingMemberDismissals = parsePendingMemberDismissals(results);

  return { settings, pendingMemberDismissals };
};

type SidebarSortMode = 'alphabetical' | 'arranged' | 'recent';

const toClientSidebarSort = (
  sort: ub.SidebarSortMode | undefined
): SidebarSortMode => {
  switch (sort) {
    case 'A → Z':
      return 'alphabetical';
    case 'Arranged':
      return 'arranged';
    case 'Recent':
      return 'recent';
  }

  return 'arranged';
};

export const toClientSettings = (
  settings: ub.GroupsDeskSettings
): db.Settings => {
  return {
    theme: settings.desk.display?.theme,
    disableAppTileUnreads: settings.desk.calmEngine?.disableAppTileUnreads,
    disableAvatars: settings.desk.calmEngine?.disableAvatars,
    disableRemoteContent: settings.desk.calmEngine?.disableRemoteContent,
    disableSpellcheck: settings.desk.calmEngine?.disableSpellcheck,
    disableNicknames: settings.desk.calmEngine?.disableNicknames,
    orderedGroupPins: settings.desk.groups?.orderedGroupPins,
    sideBarSort: toClientSidebarSort(settings.desk.groups?.sideBarSort),
    groupSideBarSort: settings.desk.groups?.groupSideBarSort,
    showActivityMessage: settings.desk.groups?.showActivityMessage,
    enableTelemetry: settings.desk.groups?.enableTelemetry,
    // DEPRECATED: use enableTelemetry instead, this is kept for settings migration
    logActivity: settings.desk.groups?.logActivity,
    analyticsId: settings.desk.groups?.analyticsId,
    seenWelcomeCard: settings.desk.groups?.seenWelcomeCard,
    newGroupFlags: settings.desk.groups?.newGroupFlags,
    groupsNavState: settings.desk.groups?.groupsNavState,
    messagesNavState: settings.desk.groups?.messagesNavState,
    messagesFilter: settings.desk.talk?.messagesFilter,
    gallerySettings: settings.desk.heaps?.heapSettings,
    notebookSettings: JSON.stringify(settings.desk.diary),
    activitySeenTimestamp: settings.desk.groups?.activitySeenTimestamp,
    completedWayfindingSplash:
      settings.desk.groups?.completedWayfindingSplash ?? false,
    completedWayfindingTutorial:
      settings.desk.groups?.completedWayfindingTutorial ?? false,
    disableTlonInfraEnhancement:
      settings.desk.groups?.disableTlonInfraEnhancement ?? false,
  };
};

export const parsePendingMemberDismissals = (
  settings: ub.GroupsDeskSettings
) => {
  const dismissals: db.PendingMemberDismissals = [];

  Object.entries(settings.desk.groups || {})
    .filter(([key]) => key.startsWith(PENDING_MEMBER_DISMISSAL_PREFIX))
    .forEach(([key, value]) => {
      const groupId = key.slice(PENDING_MEMBER_DISMISSAL_PREFIX.length);
      console.log(`Pending member dismissal for group ${groupId}: ${value}`);
      const parsedVal = Number(value);
      if (!isNaN(parsedVal)) {
        dismissals.push({
          groupId,
          dismissedAt: parsedVal,
        });
      }
    });

  return dismissals;
};

export interface ChargeUpdateInitial {
  initial: {
    [desk: string]: Charge;
  };
}

export declare type DocketHref = DocketHrefSite | DocketHrefGlob;
export interface DocketHrefGlob {
  glob: {
    base: string;
  };
}
export interface DocketHrefSite {
  site: string;
}
export interface Docket {
  title: string;
  info?: string;
  color: string;
  href: DocketHref;
  website: string;
  license: string;
  version: string;
  image?: string;
}
export interface Charge extends Docket {
  chad: Chad;
}
export declare type Chad =
  | HungChad
  | GlobChad
  | SiteChad
  | InstallChad
  | SuspendChad;
export interface HungChad {
  hung: string;
}
export interface GlobChad {
  glob: null;
}
export interface SiteChad {
  site: null;
}
export interface InstallChad {
  install: null;
}
export interface SuspendChad {
  suspend: null;
}

export interface Pike {
  hash: string;
  sync: {
    desk: string;
    ship: string;
  } | null;
  zest: 'live' | 'dead' | 'held';
}
export interface Pikes {
  [desk: string]: Pike;
}

export async function getAppInfo(): Promise<db.AppInfo> {
  const pikes = await scry<Pikes>({
    app: 'hood',
    path: '/kiln/pikes',
  });
  const charges = (
    await scry<ChargeUpdateInitial>({
      app: 'docket',
      path: '/charges',
    })
  ).initial;

  const groupsPike = pikes?.['groups'] ?? {};
  const groupsCharge = charges?.['groups'] ?? {};

  return {
    groupsVersion: groupsCharge.version ?? 'n/a',
    groupsHash: groupsPike.hash ?? 'n/a',
    groupsSyncNode: groupsPike.sync?.ship ?? 'n/a',
  };
}

export type SettingsUpdate = {
  type: 'updateSetting';
  setting: Partial<db.Settings>;
};

export function subscribeToSettings(handler: (update: SettingsUpdate) => void) {
  subscribe<ub.SettingsEvent>(
    {
      app: 'settings',
      path: '/desk/groups',
    },
    (update) => {
      if (!('settings-event' in update)) {
        return;
      }
      const event = update['settings-event'];

      if ('put-entry' in event) {
        const update = event['put-entry'];
        handler({
          type: 'updateSetting',
          setting: {
            [update['entry-key']]: update.value,
          },
        });
      }
    }
  );
}
