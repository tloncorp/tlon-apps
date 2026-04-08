import type * as db from '@tloncorp/shared/db';
import { ScrollView, Text, YStack } from 'tamagui';

import { ForwardChannelListItem } from '../ui/components/ForwardChannelListItem';
import { FixtureWrapper } from './FixtureWrapper';
import {
  createFakePost,
  danContact,
  group,
  groupWithImage,
  jamesContact,
  tlonLocalIntros,
  tlonLocalSupport,
  tlonLocalWaterCooler,
} from './fakeData';

const localGroup: db.Group = {
  ...group,
  id: '~nibset-napwyn/tlon-local',
  title: 'Tlon Local',
  iconImage: null,
  iconImageColor: '#E8AF2A',
};

const tlonGroup: db.Group = {
  ...group,
  id: '~nibset-napwyn/tlon',
  title: 'Tlon',
  iconImage: null,
  iconImageColor: '#111111',
};

const imageIconGroup: db.Group = {
  ...groupWithImage,
  id: '~nibset-napwyn/tlon-image',
  title: 'Tlon Image',
};

function withForwardVisuals(
  base: db.Channel,
  title: string,
  channelGroup: db.Group,
  previewText = 'investigation ongoing'
): db.Channel {
  return {
    ...base,
    type: 'chat',
    title,
    group: channelGroup,
    lastPost: {
      ...createFakePost('chat'),
      textContent: previewText,
    },
    unread: {
      ...(base.unread ?? {
        type: 'channel',
        channelId: base.id,
        countWithoutThreads: 0,
        updatedAt: Date.now(),
        notify: false,
        count: 0,
      }),
      type: 'channel',
      channelId: base.id,
      count: 3,
      countWithoutThreads: 3,
      notify: false,
      updatedAt: Date.now(),
    },
  };
}

const supportChannel = withForwardVisuals(
  tlonLocalSupport,
  'Support',
  localGroup
);
const devsChannel = withForwardVisuals(tlonLocalIntros, 'Devs', tlonGroup);
const etcChannel = withForwardVisuals(tlonLocalWaterCooler, 'Etc', tlonGroup);
const imageIconChannel = withForwardVisuals(
  tlonLocalSupport,
  'Ops',
  imageIconGroup
);

const noPreviewChannel: db.Channel = {
  ...withForwardVisuals(tlonLocalSupport, 'No Preview', localGroup),
  id: 'chat/~nibset-napwyn/no-preview',
  lastPost: null,
  lastPostId: null,
};

const dmChannel: db.Channel = {
  ...withForwardVisuals(
    tlonLocalIntros,
    '',
    localGroup,
    'can you send the latest mockups?'
  ),
  id: 'dm/~rilfun-lidlen',
  type: 'dm',
  groupId: null,
  group: null,
  contactId: jamesContact.id,
  members: [
    {
      contactId: jamesContact.id,
      membershipType: 'channel',
      chatId: 'dm/~rilfun-lidlen',
      contact: jamesContact,
    },
  ],
};

const groupDmChannel: db.Channel = {
  ...withForwardVisuals(
    tlonLocalIntros,
    '',
    localGroup,
    'meeting moved to 3:30'
  ),
  id: 'group-dm/ops',
  type: 'groupDm',
  groupId: null,
  group: null,
  contactId: null,
  members: [
    {
      contactId: jamesContact.id,
      membershipType: 'channel',
      chatId: 'group-dm/ops',
      contact: jamesContact,
    },
    {
      contactId: danContact.id,
      membershipType: 'channel',
      chatId: 'group-dm/ops',
      contact: danContact,
    },
  ],
};

function ForwardChannelListItemFixture() {
  return (
    <ScrollView flex={1}>
      <YStack padding="$l" gap="$l">
        <Text fontFamily="$body" color="$secondaryText">
          Reference-like rows
        </Text>
        <ForwardChannelListItem
          channel={supportChannel}
          selected
          onPress={() => {}}
        />
        <ForwardChannelListItem channel={devsChannel} onPress={() => {}} />
        <ForwardChannelListItem channel={etcChannel} onPress={() => {}} />

        <Text fontFamily="$body" color="$secondaryText">
          Group icon examples
        </Text>
        <ForwardChannelListItem channel={supportChannel} onPress={() => {}} />
        <ForwardChannelListItem channel={imageIconChannel} onPress={() => {}} />

        <Text fontFamily="$body" color="$secondaryText">
          DM and group DM examples
        </Text>
        <ForwardChannelListItem channel={dmChannel} onPress={() => {}} />
        <ForwardChannelListItem channel={groupDmChannel} onPress={() => {}} />

        <Text fontFamily="$body" color="$secondaryText">
          Edge case (no preview)
        </Text>
        <ForwardChannelListItem channel={noPreviewChannel} onPress={() => {}} />
      </YStack>
    </ScrollView>
  );
}

export default (
  <FixtureWrapper fillWidth fillHeight>
    <ForwardChannelListItemFixture />
  </FixtureWrapper>
);
