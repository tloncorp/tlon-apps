import { createDrawerNavigator } from '@react-navigation/drawer';
import { queryClient } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useEffect, useState } from 'react';
import { View } from 'tamagui';

import { TopLevelDrawerContent } from '../navigation/TopLevelDrawerContent';
import { useTopLevelDrawerScreenOptions } from '../navigation/topLevelDrawerOptions';
import { FixtureWrapper } from './FixtureWrapper';
import { group, groupWithLongTitle } from './fakeData';

const DAY = 24 * 60 * 60 * 1000;

function dm(
  id: string,
  type: 'dm' | 'groupDm',
  contactIds: string[],
  lastPostAt: number,
  unreadCount = 0
): db.Channel {
  return {
    id,
    type,
    groupId: null,
    title: '',
    description: '',
    iconImage: null,
    iconImageColor: null,
    coverImage: null,
    coverImageColor: null,
    currentUserIsMember: true,
    addedToGroupAt: null,
    lastPostAt,
    lastPostId: null,
    postCount: null,
    unreadCount,
    firstUnreadPostId: null,
    syncedAt: null,
    remoteUpdatedAt: null,
    members: contactIds.map((contactId) => ({
      contactId,
      chatId: id,
      membershipType: 'channel' as const,
    })),
  } as db.Channel;
}

/**
 * Conversations the shared fixture seed does not carry, so the panel has
 * something under both of its tabs: two workspaces of several channels each,
 * and the direct messages the Messages tab is for.
 */
const fixtureDms = [
  dm('~solfer-magfed', 'dm', ['~solfer-magfed'], Date.now() - DAY, 3),
  dm(
    '0v4.00000.qd4p2.cnv33.vqn0t.d0qk3',
    'groupDm',
    ['~ravmel-ropdyl', '~nocsyx-lassul'],
    Date.now() - 3 * DAY
  ),
];

function useSeededDrawerChats() {
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await db.insertGroups({
        groups: [
          { ...group, lastPostAt: Date.now() - 60_000 },
          { ...groupWithLongTitle, lastPostAt: Date.now() - 2 * DAY },
        ],
      });
      await db.insertChannels(fixtureDms);
      await queryClient.invalidateQueries();
      if (!cancelled) {
        setSeeded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return seeded;
}

const Drawer = createDrawerNavigator();

function Blank() {
  return <View flex={1} backgroundColor="$secondaryBackground" />;
}

/**
 * The panel as it stands, against a seeded database.
 *
 * The footer's bot pill is absent here and that is faithful rather than
 * missing: it belongs to a hosted account with its bot switched on, which a
 * fixture cannot convincingly be, and the panel is shown to accounts without
 * one exactly like this.
 */
function TopLevelDrawerFixture() {
  const seeded = useSeededDrawerChats();
  // The app's own options, so the panel is the width it really is, and then
  // permanent on top of them so it is simply on screen rather than something
  // to be swiped out before it can be looked at.
  const screenOptions = useTopLevelDrawerScreenOptions();
  if (!seeded) {
    return null;
  }
  return (
    <Drawer.Navigator
      drawerContent={(props) => <TopLevelDrawerContent {...props} />}
      screenOptions={{ ...screenOptions, drawerType: 'permanent' }}
    >
      <Drawer.Screen name="Main" component={Blank} />
    </Drawer.Navigator>
  );
}

export default (
  <FixtureWrapper fillWidth fillHeight>
    <TopLevelDrawerFixture />
  </FixtureWrapper>
);
