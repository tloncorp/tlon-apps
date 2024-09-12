import * as logic from '@tloncorp/shared/dist/logic';
import {
  ActivityScreenContent,
  AppDataContextProvider,
} from '@tloncorp/ui/src';
import { PropsWithChildren } from 'react';
import { Alert } from 'react-native';

import { FixtureWrapper } from './FixtureWrapper';
import { activityItems } from './activityHelpers';
import { exampleContacts, postsByType } from './contentHelpers';
import { tlonLocalBulletinBoard, tlonLocalGettingStarted } from './fakeData';

const baseContentProps = {
  activeTab: 'all',
  onPressTab: () => {},
  onPressEvent: () => {
    Alert.alert('Event pressed');
  },
  onEndReached: () => {},
  isFetching: false,
  isRefreshing: false,
  onRefreshTriggered: () => {},
} as const;

function ActivityFixtureWrapper({ children }: PropsWithChildren) {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <AppDataContextProvider
        currentUserId="~zod"
        contacts={Object.values(exampleContacts)}
      >
        {children}
      </AppDataContextProvider>
    </FixtureWrapper>
  );
}

const ActivityFixture = ({
  items,
}: {
  items: logic.SourceActivityEvents[];
}) => {
  return (
    <ActivityFixtureWrapper>
      <ActivityScreenContent {...baseContentProps} events={items} />
    </ActivityFixtureWrapper>
  );
};

const contentVariants = [
  ...Object.values(postsByType).map((v) =>
    activityItems.groupPost(4, {
      post: v,
    })
  ),
  activityItems.groupPostWithRandomContent(4, {
    channel: tlonLocalBulletinBoard,
  }),
  activityItems.groupPostWithRandomContent(4, {
    channel: tlonLocalGettingStarted,
  }),
];

const eventVariants = [
  ...Object.values(activityItems).map((item) => item(1)),
  activityItems.groupPost(1, {
    isMention: true,
  }),
  activityItems.groupDmPost(1, { isMention: true }),
  activityItems.groupThreadReply(1, { isMention: true }),
  activityItems.groupDmThreadReply(1, { isMention: true }),
];

const counts = [1, 2, 3, 4, 8, 16];

const countVariants = counts.map((count) => activityItems.groupPost(count));

export default {
  All: (
    <ActivityFixture
      items={[...contentVariants, ...eventVariants, ...countVariants]}
    />
  ),
  EventTypes: <ActivityFixture items={eventVariants} />,
  ContentTypes: <ActivityFixture items={contentVariants} />,
  Counts: <ActivityFixture items={countVariants} />,
};
