import type * as db from '@tloncorp/shared/dist/db';
import { ChatList } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import {
  createFakePost,
  groupWithColorAndNoImage,
  groupWithImage,
  groupWithLongTitle,
  groupWithNoColorOrImage,
  groupWithSvgImage,
} from './fakeData';

let id = 0;

function makeChannelSummary({
  group,
  channel,
  lastPost,
  members,
}: {
  channel?: Partial<db.Channel>;
  group?: db.Group;
  lastPost?: db.Post;
  members?: (db.ChatMember & { contact: db.Contact | null })[];
}): db.Channel {
  return {
    id: 'channel-' + id++,
    type: 'chat',
    title: '',
    description: '',
    groupId: group?.id ?? null,
    iconImage: null,
    iconImageColor: null,
    coverImage: null,
    coverImageColor: null,
    addedToGroupAt: null,
    currentUserIsMember: null,
    postCount: null,
    unreadCount: group?.unreadCount ?? null,
    firstUnreadPostId: null,
    lastPostId: group?.lastPostId ?? null,
    lastPostAt: group?.lastPostAt ?? null,
    syncedAt: null,
    remoteUpdatedAt: null,
    ...channel,

    group: group ?? null,
    unread: null,
    lastPost: lastPost ?? group?.lastPost ?? null,
    pin: null,
    members: members ?? null,
  };
}

const dmSummary = makeChannelSummary({
  channel: { type: 'dm' },
  lastPost: createFakePost(),
  members: [
    {
      contactId: '~solfer-magfed',
      chatId: '',
      contact: null,
      membershipType: 'channel',
      joinedAt: null,
    },
  ],
});

const groupDmSummary = makeChannelSummary({
  channel: { type: 'groupDm' },
  lastPost: createFakePost(),
  group: groupWithLongTitle,
  members: [
    {
      contactId: '~finned-palmer',
      chatId: '',
      contact: null,
      membershipType: 'channel',
      joinedAt: null,
    },
    {
      contactId: '~latter-bolden',
      chatId: '',
      contact: { nickname: 'LaTtEr BoLdEn' } as db.Contact,
      membershipType: 'channel',
      joinedAt: null,
    },
    {
      contactId: '~solfer-magfed',
      chatId: '',
      contact: null,
      membershipType: 'channel',
      joinedAt: null,
    },
  ],
});

export default {
  basic: (
    <FixtureWrapper fillWidth>
      <ChatList
        activeTab="all"
        setActiveTab={() => {}}
        showFilters={false}
        pinned={[groupWithLongTitle, groupWithImage].map((g) =>
          makeChannelSummary({ group: g })
        )}
        unpinned={[
          groupWithColorAndNoImage,
          groupWithImage,
          groupWithSvgImage,
          groupWithNoColorOrImage,
        ].map((g) => makeChannelSummary({ group: g }))}
        pendingChats={[]}
      />
    </FixtureWrapper>
  ),
  emptyPinned: (
    <FixtureWrapper fillWidth>
      <ChatList
        activeTab="all"
        setActiveTab={() => {}}
        showFilters={false}
        pinned={[dmSummary, groupDmSummary]}
        unpinned={[
          groupWithColorAndNoImage,
          groupWithImage,
          groupWithSvgImage,
          groupWithNoColorOrImage,
        ].map((g) => makeChannelSummary({ group: g }))}
        pendingChats={[]}
      />
    </FixtureWrapper>
  ),
  loading: (
    <FixtureWrapper fillWidth>
      <ChatList
        activeTab="all"
        setActiveTab={() => {}}
        showFilters={false}
        pinned={[]}
        unpinned={[]}
        pendingChats={[]}
      />
    </FixtureWrapper>
  ),
};
