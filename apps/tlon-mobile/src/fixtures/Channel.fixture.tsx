import type { ClientTypes } from '@tloncorp/shared';
import type { Story } from '@tloncorp/shared/dist/urbit/channel';
import { CalmProvider, Channel, ContactsProvider } from '@tloncorp/ui';

const createSimpleContent = (str: string): Story => {
  return [
    {
      inline: [str],
    },
  ];
};

const emptyContact: ClientTypes.Contact = {
  id: '',
  nickname: null,
  bio: null,
  color: null,
  avatarImage: null,
  status: null,
  coverImage: null,
  pinnedGroupIds: [''],
};

const galenContact: ClientTypes.Contact = {
  ...emptyContact,
  id: '~ravmel-ropdyl',
  nickname: 'galen',
};

const jamesContact: ClientTypes.Contact = {
  ...emptyContact,
  id: '~rilfun-lidlen',
  nickname: 'james',
};

const danContact: ClientTypes.Contact = {
  ...emptyContact,
  id: '~solfer-magfed',
  nickname: 'Dan',
};

const hunterContact: ClientTypes.Contact = {
  ...emptyContact,
  id: '~nocsyx-lassul',
  nickname: '~nocsyx-lassul ⚗️',
};

const brianContact: ClientTypes.Contact = {
  ...emptyContact,
  id: '~latter-bolden',
  nickname: 'brian',
};

const initialContacts: Record<string, ClientTypes.Contact> = {
  '~ravmel-ropdyl': galenContact,
  '~rilfun-lidlen': jamesContact,
  '~solfer-magfed': danContact,
  '~nocsyx-lassul': hunterContact,
  '~latter-bolden': brianContact,
};

const group: ClientTypes.Group = {
  id: '~nibset-napwyn/tlon',
  title: 'Tlon Local',
  members: [
    {
      id: '~ravmel-ropdyl',
      roles: ['admin'],
      joinedAt: 0,
    },
    {
      id: '~rilfun-lidlen',
      roles: ['admin'],
      joinedAt: 0,
    },
    {
      id: '~solfer-magfed',
      roles: ['admin'],
      joinedAt: 0,
    },
    {
      id: '~nocsyx-lassul',
      roles: ['admin'],
      joinedAt: 0,
    },
    {
      id: '~latter-bolden',
      roles: ['admin'],
      joinedAt: 0,
    },
  ],
  isSecret: false,
};

const channel: ClientTypes.Channel = {
  id: '~nibset-napwyn/intros',
  title: 'Intros',
  group,
};

const createFakePost = (str: string, ship: string): ClientTypes.Post => {
  return {
    id: `${ship}-${str}`,
    author: initialContacts[ship],
    channel,
    content: JSON.stringify(createSimpleContent(str)),
    sentAt: '0',
    replyCount: 0,
    type: 'chat',
    group,
  };
};

const posts: ClientTypes.Post[] = [
  createFakePost('yo', '~ravmel-ropdyl'),
  createFakePost('hey', '~rilfun-lidlen'),
];

const ChannelFixture = () => (
  <CalmProvider
    initialCalm={{
      disableAppTileUnreads: false,
      disableAvatars: false,
      disableNicknames: false,
      disableRemoteContent: false,
      disableSpellcheck: false,
    }}
  >
    <ContactsProvider initialContacts={initialContacts}>
      <Channel
        posts={posts}
        channel={channel}
        goBack={() => {}}
        goToSearch={() => {}}
        goToChannels={() => {}}
      />
    </ContactsProvider>
  </CalmProvider>
);

export default ChannelFixture;
