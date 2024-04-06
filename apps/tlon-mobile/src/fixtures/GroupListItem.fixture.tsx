import type * as db from '@tloncorp/shared/dist/db';
import { GroupListItem, View } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { createFakePost } from './fakeData';

const dates = {
  now: Date.now(),
  earlierToday: Date.now() - 1000 * 60 * 60 * 2,
  yesterday: Date.now() - 1000 * 60 * 60 * 24,
  lastWeek: Date.now() - 1000 * 60 * 60 * 24 * 7,
  lastMonth: Date.now() - 1000 * 60 * 60 * 24 * 30,
};

const testGroup: db.GroupSummary = {
  id: '1',
  title: 'Test Group',
  pinIndex: 0,
  isSecret: false,
  unreadCount: 1,
  iconImage: null,
  iconImageColor: '#FF00FF',
  coverImage: null,
  coverImageColor: null,
  description: 'A test group',
  isJoined: true,
  lastPostId: 'test-post',
  lastPostAt: dates.now,
  lastPost: { ...createFakePost() },
};

const groupWithLongTitle = {
  ...testGroup,
  title: 'And here, a reallly long title, wazzup, ok',
  textContent: 'HIIIIIIIIIII',
  lastPostAt: dates.earlierToday,
  lastPost: {
    ...createFakePost(),
    textContent:
      'This is a line that will be long enough to fill all of the available space.',
  },
};

const groupWithNoColorOrImage = {
  ...testGroup,
  iconImageColor: null,
  lastPost: createFakePost(),
  lastPostAt: dates.yesterday,
  unreadCount: Math.floor(Math.random() * 20),
};

const groupWithImage = {
  ...testGroup,
  iconImage:
    'https://dans-gifts.s3.amazonaws.com/dans-gifts/solfer-magfed/2024.4.6..15.49.54..4a7e.f9db.22d0.e560-IMG_4770.jpg',
  lastPost: createFakePost(),
  lastPostAt: dates.lastWeek,
  unreadCount: Math.floor(Math.random() * 20),
};

const groupWithSvgImage = {
  ...testGroup,
  iconImage: 'https://tlon.io/local-icon.svg',
  lastPost: createFakePost(),
  lastPostAt: dates.lastMonth,
  unreadCount: Math.floor(Math.random() * 20),
};

export default {
  basic: (
    <FixtureWrapper fillWidth innerBackgroundColor="$secondaryBackground">
      <View gap="$s" paddingHorizontal="$l">
        <GroupListItem model={testGroup} />
        <GroupListItem model={groupWithImage} />
        <GroupListItem model={groupWithSvgImage} />
        <GroupListItem model={groupWithLongTitle} />
        <GroupListItem model={groupWithNoColorOrImage} />
      </View>
    </FixtureWrapper>
  ),
};
