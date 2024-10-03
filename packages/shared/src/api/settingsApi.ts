import * as db from '../db';
import * as ub from '../urbit';
import { client } from './urbit';

export const getSettings = async () => {
  const results = await client.scry<ub.GroupsDeskSettings>({
    app: 'settings',
    path: '/desk/groups',
  });
  return toClientSettings(results);
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
  if (!client.ship) {
    throw new Error('Client not configured');
  }

  return {
    userId: client.ship,
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
    logActivity: settings.desk.groups?.logActivity,
    analyticsId: settings.desk.groups?.analyticsId,
    seenWelcomeCard: settings.desk.groups?.seenWelcomeCard,
    newGroupFlags: settings.desk.groups?.newGroupFlags,
    groupsNavState: settings.desk.groups?.groupsNavState,
    messagesNavState: settings.desk.groups?.messagesNavState,
    messagesFilter: settings.desk.talk?.messagesFilter,
    gallerySettings: settings.desk.heaps?.heapSettings,
    notebookSettings: JSON.stringify(settings.desk.diary),
  };
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
  const pikes = await client.scry<Pikes>({
    app: 'hood',
    path: '/kiln/pikes',
  });
  const charges = (
    await client.scry<ChargeUpdateInitial>({
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
