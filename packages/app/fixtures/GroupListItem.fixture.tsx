import type { VolumeSettings } from '@tloncorp/shared/db';
import type { NotificationLevel } from '@tloncorp/shared/urbit';

import { GroupListItem, View } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import {
  postWithDeleted,
  postWithHidden,
  postWithText,
} from './contentHelpers';
import {
  groupWithColorAndNoImage,
  groupWithImage,
  groupWithLongTitle,
  groupWithNoColorOrImage,
  groupWithSvgImage,
} from './fakeData';

// Create variations with different muted states and post types
const groupMuted = {
  ...groupWithColorAndNoImage,
  id: '~nibset-napwyn/tlon/muted-group',
  title: 'Muted Group',
  volumeSettings: {
    itemId: '~nibset-napwyn/tlon/muted-group',
    itemType: 'group' as const,
    level: 'soft' as NotificationLevel,
  } satisfies VolumeSettings,
  lastPost: postWithText,
};

const groupWithDeletedPost = {
  ...groupWithNoColorOrImage,
  id: '~nibset-napwyn/tlon/deleted-post',
  title: 'Group with Deleted Post',
  lastPost: postWithDeleted,
};

const groupWithHiddenPost = {
  ...groupWithImage,
  id: '~nibset-napwyn/tlon/hidden-post',
  title: 'Group with Hidden Post',
  lastPost: postWithHidden,
};

const groupMutedWithDeletedPost = {
  ...groupWithSvgImage,
  id: '~nibset-napwyn/tlon/muted-deleted',
  title: 'Muted Group with Deleted Post',
  volumeSettings: {
    itemId: '~nibset-napwyn/tlon/muted-deleted',
    itemType: 'group' as const,
    level: 'hush' as NotificationLevel,
  } satisfies VolumeSettings,
  lastPost: postWithDeleted,
};

const groupWithNoPosts = {
  ...groupWithLongTitle,
  id: '~nibset-napwyn/tlon/no-posts',
  title: 'Group with No Posts',
  lastPost: null,
  lastPostAt: null,
};

export default {
  basic: (
    <FixtureWrapper fillWidth>
      <View gap="$s" paddingHorizontal="$l">
        <GroupListItem model={groupWithColorAndNoImage} />
        <GroupListItem model={groupWithImage} />
        <GroupListItem model={groupWithSvgImage} />
        <GroupListItem model={groupWithLongTitle} />
        <GroupListItem model={groupWithNoColorOrImage} />
      </View>
    </FixtureWrapper>
  ),

  mutedStates: (
    <FixtureWrapper fillWidth>
      <View gap="$s" paddingHorizontal="$l">
        <GroupListItem model={groupWithColorAndNoImage} />
        <GroupListItem model={groupMuted} />
        <GroupListItem model={groupMutedWithDeletedPost} />
      </View>
    </FixtureWrapper>
  ),

  postStates: (
    <FixtureWrapper fillWidth>
      <View gap="$s" paddingHorizontal="$l">
        <GroupListItem model={groupWithColorAndNoImage} />
        <GroupListItem model={groupWithDeletedPost} />
        <GroupListItem model={groupWithHiddenPost} />
        <GroupListItem model={groupWithNoPosts} />
      </View>
    </FixtureWrapper>
  ),

  allStates: (
    <FixtureWrapper fillWidth>
      <View gap="$s" paddingHorizontal="$l">
        <GroupListItem model={groupWithColorAndNoImage} />
        <GroupListItem model={groupMuted} />
        <GroupListItem model={groupWithDeletedPost} />
        <GroupListItem model={groupWithHiddenPost} />
        <GroupListItem model={groupMutedWithDeletedPost} />
        <GroupListItem model={groupWithNoPosts} />
      </View>
    </FixtureWrapper>
  ),
};
