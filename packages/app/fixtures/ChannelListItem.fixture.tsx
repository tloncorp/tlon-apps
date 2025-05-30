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
    level: 'hush' as const,
  } as any,
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
    level: 'hush' as const,
  } as any,
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
  ] as any,
};

const dmChannelMuted = {
  ...dmChannel,
  id: '~solfer-magfed/dm-muted',
  title: 'Dan (Muted)',
  volumeSettings: {
    itemId: '~solfer-magfed/dm-muted',
    itemType: 'channel' as const,
    level: 'hush' as const,
  } as any,
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
  ] as any,
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
        <ChannelListItem model={channelMuted as any} />
        <ChannelListItem model={channelMutedWithDeletedPost as any} />
      </View>
    </FixtureWrapper>
  ),

  postStates: (
    <FixtureWrapper fillWidth>
      <View gap="$s" paddingHorizontal="$l">
        <ChannelListItem model={tlonLocalIntros} />
        <ChannelListItem model={channelWithDeletedPost as any} />
        <ChannelListItem model={channelWithHiddenPost as any} />
        <ChannelListItem model={channelWithNoPosts as any} />
      </View>
    </FixtureWrapper>
  ),

  dmChannels: (
    <FixtureWrapper fillWidth>
      <View gap="$s" paddingHorizontal="$l">
        <ChannelListItem model={dmChannel as any} />
        <ChannelListItem model={dmChannelMuted as any} />
      </View>
    </FixtureWrapper>
  ),

  allStates: (
    <FixtureWrapper fillWidth>
      <View gap="$s" paddingHorizontal="$l">
        <ChannelListItem model={tlonLocalIntros} />
        <ChannelListItem model={channelMuted as any} />
        <ChannelListItem model={channelWithDeletedPost as any} />
        <ChannelListItem model={channelWithHiddenPost as any} />
        <ChannelListItem model={channelMutedWithDeletedPost as any} />
        <ChannelListItem model={channelWithNoPosts as any} />
        <ChannelListItem model={dmChannel as any} />
        <ChannelListItem model={dmChannelMuted as any} />
      </View>
    </FixtureWrapper>
  ),
};
