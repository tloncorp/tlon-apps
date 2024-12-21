import type * as db from '@tloncorp/shared/db';
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

function makeChat({
  group,
  channel,
  lastPost,
  members,
}: {
  channel?: Partial<db.Channel>;
  group?: db.Group;
  lastPost?: db.Post;
  members?: (db.ChatMember & { contact: db.Contact | null })[];
}): db.Chat {
  if (group) {
    const groupId = 'group-' + id++;
    return {
      type: 'group',
      id: groupId,
      group: { ...group, id: groupId },
      isPending: false,
      pin: group.pin ?? null,
      timestamp: group.unread?.updatedAt ?? group.lastPostAt ?? 0,
      volumeSettings: group.volumeSettings ?? null,
      unreadCount: 0,
    };
  }

  const channelId = 'channel-' + id++;
  return {
    type: 'channel',
    id: channelId,
    timestamp: lastPost?.sentAt ?? 0,
    isPending: !!channel?.isDmInvite,
    volumeSettings: channel?.volumeSettings ?? null,
    pin: null,
    unreadCount: 0,
    channel: {
      id: channelId,
      type: 'chat',
      title: '',
      description: '',
      iconImage: null,
      iconImageColor: null,
      coverImage: null,
      coverImageColor: null,
      addedToGroupAt: null,
      currentUserIsMember: null,
      postCount: null,
      firstUnreadPostId: null,
      syncedAt: null,
      remoteUpdatedAt: null,
      ...channel,
      group: group ?? null,
      unread: null,
      lastPost: lastPost ?? null,
      pin: null,
      members: members ?? null,
    },
  };
}

const dmSummary = makeChat({
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

const groupDmSummary = makeChat({
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
    <FixtureWrapper fillWidth fillHeight safeArea>
      <ChatList
        activeTab="all"
        setActiveTab={() => {}}
        searchQuery=""
        onSearchQueryChange={() => {}}
        showSearchInput={false}
        pinned={[groupWithLongTitle, groupWithImage].map((g) =>
          makeChat({ group: g })
        )}
        unpinned={[
          groupWithColorAndNoImage,
          groupWithImage,
          groupWithNoColorOrImage,
        ].map((g) => makeChat({ group: g }))}
        pending={[]}
        onSearchToggle={() => {}}
      />
    </FixtureWrapper>
  ),
  emptyPinned: (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <ChatList
        activeTab="all"
        setActiveTab={() => {}}
        showSearchInput={false}
        pinned={[dmSummary, groupDmSummary]}
        unpinned={[
          groupWithColorAndNoImage,
          groupWithImage,
          groupWithSvgImage,
          groupWithNoColorOrImage,
        ].map((g) => makeChat({ group: g }))}
        pending={[]}
        searchQuery=""
        onSearchQueryChange={() => {}}
        onSearchToggle={() => {}}
      />
    </FixtureWrapper>
  ),
  loading: (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <ChatList
        activeTab="all"
        setActiveTab={() => {}}
        showSearchInput={false}
        pinned={[]}
        unpinned={[]}
        pending={[]}
        searchQuery=""
        onSearchQueryChange={() => {}}
        onSearchToggle={() => {}}
      />
    </FixtureWrapper>
  ),
};
