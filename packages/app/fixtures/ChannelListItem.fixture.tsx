import type { ChatMember, VolumeSettings } from '@tloncorp/shared/db';
import type { NotificationLevel } from '@tloncorp/shared/urbit';

import { ChannelListItem, View } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import {
  postWithDeleted,
  postWithHidden,
  postWithText,
} from './contentHelpers';
import {
  tlonLocalBulletinBoard,
  tlonLocalGettingStarted,
  tlonLocalIntros,
  tlonLocalSupport,
  tlonLocalWaterCooler,
} from './fakeData';

// Create variations with different muted states and post types
const channelMuted = {
  ...tlonLocalIntros,
  id: 'chat/~nibset-napwyn/muted-channel',
  title: 'Muted Channel',
  volumeSettings: {
    itemId: 'chat/~nibset-napwyn/muted-channel',
    itemType: 'channel' as const,
    level: 'hush' as NotificationLevel,
  } satisfies VolumeSettings,
  lastPost: postWithText,
};

const channelWithDeletedPost = {
  ...tlonLocalWaterCooler,
  id: 'chat/~nibset-napwyn/deleted-post',
  title: 'Channel with Deleted Post',
  lastPost: postWithDeleted,
};

const channelWithHiddenPost = {
  ...tlonLocalSupport,
  id: 'chat/~nibset-napwyn/hidden-post',
  title: 'Channel with Hidden Post',
  lastPost: postWithHidden,
};

const channelMutedWithDeletedPost = {
  ...tlonLocalBulletinBoard,
  id: 'heap/~nibset-napwyn/muted-deleted',
  title: 'Muted Channel with Deleted Post',
  volumeSettings: {
    itemId: 'heap/~nibset-napwyn/muted-deleted',
    itemType: 'channel' as const,
    level: 'hush' as NotificationLevel,
  } satisfies VolumeSettings,
  lastPost: postWithDeleted,
};

const channelWithNoPosts = {
  ...tlonLocalGettingStarted,
  id: 'diary/~nibset-napwyn/no-posts',
  title: 'Channel with No Posts',
  lastPost: null,
  lastPostAt: null,
  lastPostId: null,
};

const dmChannel = {
  ...tlonLocalIntros,
  id: '~rilfun-lidlen/dm',
  type: 'dm' as const,
  title: 'James',
  description: '',
  lastPost: postWithText,
  members: [
    {
      contactId: '~rilfun-lidlen',
      membershipType: 'channel' as const,
      contact: {
        id: '~rilfun-lidlen',
        nickname: 'james',
        color: '#00FF00',
      },
    },
  ] satisfies ChatMember[],
};

const dmChannelMuted = {
  ...dmChannel,
  id: '~solfer-magfed/dm-muted',
  title: 'Dan (Muted)',
  volumeSettings: {
    itemId: '~solfer-magfed/dm-muted',
    itemType: 'channel' as const,
    level: 'hush' as NotificationLevel,
  } satisfies VolumeSettings,
  members: [
    {
      contactId: '~solfer-magfed',
      membershipType: 'channel' as const,
      contact: {
        id: '~solfer-magfed',
        nickname: 'Dan',
        color: '#FFFF99',
      },
    },
  ] satisfies ChatMember[],
};

export default {
  basic: (
    <FixtureWrapper fillWidth>
      <View gap="$s" paddingHorizontal="$l">
        <ChannelListItem model={tlonLocalIntros} />
        <ChannelListItem model={tlonLocalWaterCooler} />
        <ChannelListItem model={tlonLocalSupport} />
        <ChannelListItem model={tlonLocalBulletinBoard} />
        <ChannelListItem model={tlonLocalGettingStarted} />
      </View>
    </FixtureWrapper>
  ),

  mutedStates: (
    <FixtureWrapper fillWidth>
      <View gap="$s" paddingHorizontal="$l">
        <ChannelListItem model={tlonLocalIntros} />
        <ChannelListItem model={channelMuted} />
        <ChannelListItem model={channelMutedWithDeletedPost} />
      </View>
    </FixtureWrapper>
  ),

  postStates: (
    <FixtureWrapper fillWidth>
      <View gap="$s" paddingHorizontal="$l">
        <ChannelListItem model={tlonLocalIntros} />
        <ChannelListItem model={channelWithDeletedPost} />
        <ChannelListItem model={channelWithHiddenPost} />
        <ChannelListItem model={channelWithNoPosts} />
      </View>
    </FixtureWrapper>
  ),

  dmChannels: (
    <FixtureWrapper fillWidth>
      <View gap="$s" paddingHorizontal="$l">
        <ChannelListItem model={dmChannel} />
        <ChannelListItem model={dmChannelMuted} />
      </View>
    </FixtureWrapper>
  ),

  allStates: (
    <FixtureWrapper fillWidth>
      <View gap="$s" paddingHorizontal="$l">
        <ChannelListItem model={tlonLocalIntros} />
        <ChannelListItem model={channelMuted} />
        <ChannelListItem model={channelWithDeletedPost} />
        <ChannelListItem model={channelWithHiddenPost} />
        <ChannelListItem model={channelMutedWithDeletedPost} />
        <ChannelListItem model={channelWithNoPosts} />
        <ChannelListItem model={dmChannel} />
        <ChannelListItem model={dmChannelMuted} />
      </View>
    </FixtureWrapper>
  ),
};
