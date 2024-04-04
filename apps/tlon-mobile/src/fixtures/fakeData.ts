import type * as db from '@tloncorp/shared/dist/db';
import type { Story } from '@tloncorp/shared/dist/urbit/channel';

export const createSimpleContent = (str: string): string => {
  return JSON.stringify([
    {
      inline: [str],
    },
  ] as Story);
};

export const createImageContent = (url: string): string => {
  return JSON.stringify([
    {
      block: {
        image: {
          src: url,
          height: 200,
          width: 200,
        },
      },
    },
  ] as Story);
};

export const createCodeContent = (code: string): string => {
  return JSON.stringify([
    {
      inline: [
        {
          code,
        },
      ],
    },
  ] as Story);
};

export const emptyContact: db.Contact = {
  id: '',
  nickname: null,
  bio: null,
  color: null,
  avatarImage: null,
  status: null,
  coverImage: null,
};

export const galenContact: db.Contact = {
  ...emptyContact,
  id: '~ravmel-ropdyl',
  nickname: 'galen',
  color: '#CCCCCC',
};

export const jamesContact: db.Contact = {
  ...emptyContact,
  id: '~rilfun-lidlen',
  nickname: 'james',
};

export const danContact: db.Contact = {
  ...emptyContact,
  id: '~solfer-magfed',
  nickname: 'Dan',
  color: '#FFFF99',
};

export const hunterContact: db.Contact = {
  ...emptyContact,
  id: '~nocsyx-lassul',
  nickname: '~nocsyx-lassul ⚗️',
  color: '#5200FF',
};

export const brianContact: db.Contact = {
  ...emptyContact,
  id: '~latter-bolden',
  nickname: 'brian',
  avatarImage:
    'https://d2w9rnfcy7mm78.cloudfront.net/24933700/original_92dc8654172254b5422d0d6249270afe.png?1701105163?bc=0',
};

export const markContact: db.Contact = {
  ...emptyContact,
  id: '~palfun-foslup',
  color: '#2AA779',
};

export const edContact: db.Contact = {
  ...emptyContact,
  id: '~fabled-faster',
  nickname: 'éd',
  color: '#C0C3D8',
};

export const initialContacts: db.Contact[] = [
  galenContact,
  jamesContact,
  danContact,
  hunterContact,
  brianContact,
  markContact,
  edContact,
];

export const roles: db.GroupRole[] = [
  {
    id: 'admin',
    coverImage: null,
    groupId: '~nibset-napwyn/tlon',
    title: 'Admin',
    description: 'Admins can do anything',
    iconImage: null,
  },
];

const emptyChannel: db.Channel = {
  id: '',
  groupId: '',
  type: 'chat',
  title: '',
  description: '',
  iconImage: null,
  coverImage: null,
  currentUserIsMember: true,
  addedToGroupAt: null,
  lastPostAt: null,
  lastPostId: null,
  postCount: null,
  unreadCount: null,
  firstUnreadPostId: null,
  syncedAt: null,
  remoteUpdatedAt: null,
};

export const tlonLocalIntros: db.Channel = {
  ...emptyChannel,
  id: '~nibset-napwyn/intros',
  type: 'chat',
  groupId: '~nibset-napwyn/tlon',
  title: 'Intros',
  description: 'Introduce yourself to the group',
};

export const tlonLocalWaterCooler: db.Channel = {
  ...emptyChannel,
  id: '~nibset-napwyn/water-cooler',
  type: 'chat',
  groupId: '~nibset-napwyn/tlon',
  title: 'Internet Cafe',
  description: 'General chat',
};

export const tlonLocalSupport: db.Channel = {
  ...emptyChannel,
  id: '~nibset-napwyn/support',
  type: 'chat',
  groupId: '~nibset-napwyn/tlon',
  title: 'Support',
  description: 'Get help with Tlon',
};

export const tlonLocalBulletinBoard: db.Channel = {
  ...emptyChannel,
  id: '~nibset-napwyn/bulletin-board',
  type: 'gallery',
  groupId: '~nibset-napwyn/tlon',
  title: 'Bulletin Board',
  description: 'Important announcements',
};

export const tlonLocalCommunityCatalog: db.Channel = {
  ...emptyChannel,
  id: '~nibset-napwyn/community-catalog',
  type: 'gallery',
  groupId: '~nibset-napwyn/tlon',
  title: 'Community Catalog',
  description: 'Find other groups',
};

export const tlonLocalGettingStarted: db.Channel = {
  ...emptyChannel,
  id: '~nibset-napwyn/getting-started',
  type: 'notebook',
  groupId: '~nibset-napwyn/tlon',
  title: 'Getting Started',
  description: 'Get started with Tlon',
};

const tlonLocalChannels: db.Channel[] = [
  tlonLocalIntros,
  tlonLocalWaterCooler,
  tlonLocalSupport,
  tlonLocalGettingStarted,
  tlonLocalBulletinBoard,
  tlonLocalCommunityCatalog,
];

const tlonLocalNavSections: db.GroupnavSectionWithRelations[] = [
  {
    index: 0,
    id: 'welcome-zone-id',
    groupId: '~nibset-napwyn/tlon',
    title: 'Welcome',
    coverImage: null,
    iconImage: null,
    description: 'Welcome to Tlon Local',
    channels: [
      {
        channelId: tlonLocalIntros.id,
        index: 1,
        groupNavSectionId: 'welcome-zone-id',
      },
      {
        channelId: tlonLocalGettingStarted.id,
        index: 0,
        groupNavSectionId: 'welcome-zone-id',
      },
    ],
  },
  {
    index: 1,
    id: 'discuss-zone-id',
    groupId: '~nibset-napwyn/tlon',
    title: 'Discuss',
    coverImage: null,
    iconImage: null,
    description: 'Discuss things',
    channels: [
      {
        channelId: tlonLocalWaterCooler.id,
        index: 0,
        groupNavSectionId: 'discuss-zone-id',
      },
      {
        channelId: tlonLocalSupport.id,
        index: 1,
        groupNavSectionId: 'discuss-zone-id',
      },
    ],
  },
  {
    index: 2,
    id: 'catalog-zone-id',
    groupId: '~nibset-napwyn/tlon',
    title: 'Catalog',
    coverImage: null,
    iconImage: null,
    description: 'Find cool stuff',
    channels: [
      {
        channelId: tlonLocalBulletinBoard.id,
        index: 0,
        groupNavSectionId: 'catalog-zone-id',
      },
      {
        channelId: tlonLocalCommunityCatalog.id,
        index: 1,
        groupNavSectionId: 'catalog-zone-id',
      },
    ],
  },
];

export const group: db.GroupWithRelations = {
  id: '~nibset-napwyn/tlon',
  title: 'Tlon Local',
  channels: tlonLocalChannels,
  navSections: tlonLocalNavSections,
  roles,
  pinIndex: 0,
  coverImage: null,
  coverImageColor: '#000000',
  iconImage: null,
  iconImageColor: '#FFFFFF',
  isJoined: true,
  lastPostAt: null,
  description: 'Tlon Local',
  members: [
    {
      contactId: '~ravmel-ropdyl',
      joinedAt: 0,
      groupId: '~nibset-napwyn/tlon',
    },
    {
      contactId: '~rilfun-lidlen',
      joinedAt: 0,
      groupId: '~nibset-napwyn/tlon',
    },
    {
      contactId: '~solfer-magfed',
      joinedAt: 0,
      groupId: '~nibset-napwyn/tlon',
    },
    {
      contactId: '~nocsyx-lassul',
      joinedAt: 0,
      groupId: '~nibset-napwyn/tlon',
    },
    {
      contactId: '~latter-bolden',
      joinedAt: 0,
      groupId: '~nibset-napwyn/tlon',
    },
  ],
  isSecret: false,
};

export const fakeContent: Record<string, db.Post['content']> = {
  yo: createSimpleContent('yo'),
  hey: createSimpleContent('hey'),
  lol: createSimpleContent('lol'),
  sup: createSimpleContent('sup'),
  hi: createSimpleContent('hi'),
  hello: createSimpleContent('hello'),
  howdy: createSimpleContent('howdy'),
  greetings: createSimpleContent('greetings'),
  salutations: createSimpleContent('salutations'),
  why: createSimpleContent('why?'),
  what: createSimpleContent('what?'),
  where: createSimpleContent('where?'),
  when: createSimpleContent('when?'),
  how: createSimpleContent('how?'),
  who: createSimpleContent('who?'),
  whom: createSimpleContent('whom?'),
  whose: createSimpleContent('whose?'),
  '😧': createSimpleContent('😧'),
  '😨': createSimpleContent('😨'),
  '😩': createSimpleContent('😩'),
  '😪': createSimpleContent('😪'),
};

const getRandomFakeContent = () => {
  // randomly add an image
  if (Math.random() < 0.2) {
    return createImageContent(
      'https://togten.com:9001/finned-palmer/finned-palmer/2024.3.19..21.2.17..5581.0624.dd2f.1a9f-image.png'
    );
  }

  // randomly add code
  if (Math.random() < 0.2) {
    return createCodeContent('console.log("hello world");');
  }

  const keys = Object.keys(fakeContent);
  return fakeContent[keys[Math.floor(Math.random() * keys.length)]];
};

const getRandomFakeContact = () => {
  const keys = Object.keys(initialContacts);
  return initialContacts[Math.floor(Math.random() * keys.length)];
};

export const createFakePost = (): db.PostWithRelations => {
  const fakeContact = getRandomFakeContact();
  const ship = fakeContact.id;
  const id = Math.random().toString(36).substring(7);
  // timestamp on same day
  const randomSentAtSameDay = new Date(
    new Date().getTime() - Math.floor(Math.random() * 10000000)
  ).getTime();

  return {
    id: `${ship}-${id}`,
    authorId: ship,
    author: fakeContact,
    content: getRandomFakeContent(),
    sentAt: randomSentAtSameDay,
    replyCount: 0,
    type: 'chat',
    groupId: group.id,
    channelId: tlonLocalIntros.id,
    title: null,
    hasImage: null,
    image: null,
    receivedAt: randomSentAtSameDay,
    textContent: null,
    hasAppReference: null,
    hasChannelReference: null,
    hasGroupReference: null,
    hasLink: null,
    reactions: null,
  };
};

export const createFakePosts = (count: number): db.PostWithRelations[] => {
  const posts = [];
  for (let i = 0; i < count; i++) {
    posts.push(createFakePost());
  }

  // sort by timestamp
  posts.sort((a, b) => {
    return b.sentAt! - a.sentAt!;
  });

  return posts;
};
