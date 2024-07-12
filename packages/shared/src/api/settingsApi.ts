import { ChargeUpdateInitial, Pikes, getPikes, scryCharges } from '@urbit/api';

import * as db from '../db';
import * as ub from '../urbit';
import { client, scry } from './urbit';

export const getSettings = async () => {
  const results = await scry<ub.GroupsDeskSettings>({
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

export async function getAppInfo(): Promise<db.AppInfo> {
  const pikes = await scry<Pikes>(getPikes);
  const charges = (await scry<ChargeUpdateInitial>(scryCharges)).initial;

  const groupsPike = pikes?.['groups'] ?? {};
  const groupsCharge = charges?.['groups'] ?? {};

  return {
    groupsVersion: groupsCharge.version ?? 'n/a',
    groupsHash: groupsPike.hash ?? 'n/a',
    groupsSyncNode: groupsPike.sync?.ship ?? 'n/a',
  };
}
