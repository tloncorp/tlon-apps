import type * as db from '@tloncorp/shared/dist/db';
import { getTextContent } from '@tloncorp/shared/dist/urbit';
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
    coverImageColor: null,
    groupId: '~nibset-napwyn/tlon',
    title: 'Admin',
    description: 'Admins can do anything',
    iconImage: null,
    iconImageColor: null,
  },
];

const emptyChannel: db.Channel = {
  id: '',
  groupId: '',
  type: 'chat',
  title: '',
  description: '',
  iconImage: null,
  iconImageColor: null,
  coverImage: null,
  coverImageColor: null,
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

export const tlonLocalIntros: db.ChannelWithLastPostAndMembers = {
  ...emptyChannel,
  id: '~nibset-napwyn/intros',
  type: 'chat',
  groupId: '~nibset-napwyn/tlon',
  title: 'Intros',
  description: 'Introduce yourself to the group',
  lastPostId: '1',
  unreadCount: 40,
  lastPost: {
    id: '1',
    authorId: '~ravmel-ropdyl',
    content: createSimpleContent('hello'),
    sentAt: 0,
    replyCount: 0,
    type: 'chat',
    groupId: '~nibset-napwyn/tlon',
    channelId: '~nibset-napwyn/intros',
    title: null,
    hasImage: null,
    image: null,
    receivedAt: 0,
    textContent:
      getTextContent(JSON.parse(createSimpleContent('hello'))) ?? null,
    hasAppReference: null,
    hasChannelReference: null,
    hasGroupReference: null,
    hasLink: null,
  },
};

export const tlonLocalWaterCooler: db.ChannelWithLastPostAndMembers = {
  ...emptyChannel,
  id: '~nibset-napwyn/water-cooler',
  type: 'chat',
  groupId: '~nibset-napwyn/tlon',
  title: 'Internet Cafe',
  description: 'General chat',
  lastPostId: '2',
  unreadCount: 31,
  lastPost: {
    id: '2',
    authorId: '~rilfun-lidlen',
    content: createSimpleContent('hey'),
    sentAt: 0,
    replyCount: 0,
    type: 'chat',
    groupId: '~nibset-napwyn/tlon',
    channelId: '~nibset-napwyn/water-cooler',
    title: null,
    hasImage: null,
    image: null,
    receivedAt: 0,
    textContent: getTextContent(JSON.parse(createSimpleContent('hey'))) ?? null,
    hasAppReference: null,
    hasChannelReference: null,
    hasGroupReference: null,
    hasLink: null,
  },
};

export const tlonLocalSupport: db.ChannelWithLastPostAndMembers = {
  ...emptyChannel,
  id: '~nibset-napwyn/support',
  type: 'chat',
  groupId: '~nibset-napwyn/tlon',
  title: 'Support',
  description: 'Get help with Tlon',
  lastPostId: '3',
  unreadCount: 27,
  lastPost: {
    id: '3',
    authorId: '~solfer-magfed',
    content: createSimpleContent('sup'),
    sentAt: 0,
    replyCount: 0,
    type: 'chat',
    groupId: '~nibset-napwyn/tlon',
    channelId: '~nibset-napwyn/support',
    title: null,
    hasImage: null,
    image: null,
    receivedAt: 0,
    textContent: getTextContent(JSON.parse(createSimpleContent('sup'))) ?? null,
    hasAppReference: null,
    hasChannelReference: null,
    hasGroupReference: null,
    hasLink: null,
  },
};

export const tlonLocalBulletinBoard: db.ChannelWithLastPostAndMembers = {
  ...emptyChannel,
  id: '~nibset-napwyn/bulletin-board',
  type: 'gallery',
  groupId: '~nibset-napwyn/tlon',
  title: 'Bulletin Board',
  description: 'Important announcements',
  lastPostId: '4',
  unreadCount: 0,
  lastPost: {
    id: '4',
    authorId: '~nocsyx-lassul',
    content: createSimpleContent('yo'),
    sentAt: 0,
    replyCount: 0,
    type: 'chat',
    groupId: '~nibset-napwyn/tlon',
    channelId: '~nibset-napwyn/bulletin-board',
    title: null,
    hasImage: null,
    image: null,
    receivedAt: 0,
    textContent: getTextContent(JSON.parse(createSimpleContent('yo'))) ?? null,
    hasAppReference: null,
    hasChannelReference: null,
    hasGroupReference: null,
    hasLink: null,
  },
};

export const tlonLocalCommunityCatalog: db.ChannelWithLastPostAndMembers = {
  ...emptyChannel,
  id: '~nibset-napwyn/community-catalog',
  type: 'gallery',
  groupId: '~nibset-napwyn/tlon',
  title: 'Community Catalog',
  description: 'Find other groups',
  lastPostId: '5',
  lastPost: {
    id: '5',
    authorId: '~latter-bolden',
    content: createSimpleContent('lol'),
    sentAt: 0,
    replyCount: 0,
    type: 'chat',
    groupId: '~nibset-napwyn/tlon',
    channelId: '~nibset-napwyn/community-catalog',
    title: null,
    hasImage: null,
    image: null,
    receivedAt: 0,
    textContent: getTextContent(JSON.parse(createSimpleContent('lol'))) ?? null,
    hasAppReference: null,
    hasChannelReference: null,
    hasGroupReference: null,
    hasLink: null,
  },
};

export const tlonLocalGettingStarted: db.ChannelWithLastPostAndMembers = {
  ...emptyChannel,
  id: '~nibset-napwyn/getting-started',
  type: 'notebook',
  groupId: '~nibset-napwyn/tlon',
  title: 'Getting Started',
  description: 'Get started with Tlon',
  lastPostId: '6',
  lastPost: {
    id: '6',
    authorId: '~ravmel-ropdyl',
    content: createSimpleContent('hi'),
    sentAt: 0,
    replyCount: 0,
    type: 'chat',
    groupId: '~nibset-napwyn/tlon',
    channelId: '~nibset-napwyn/getting-started',
    title: null,
    hasImage: null,
    image: null,
    receivedAt: 0,
    textContent: getTextContent(JSON.parse(createSimpleContent('hi'))) ?? null,
    hasAppReference: null,
    hasChannelReference: null,
    hasGroupReference: null,
    hasLink: null,
  },
};

const tlonLocalChannels: db.ChannelWithLastPostAndMembers[] = [
  tlonLocalIntros,
  tlonLocalWaterCooler,
  tlonLocalSupport,
  tlonLocalGettingStarted,
  tlonLocalBulletinBoard,
  tlonLocalCommunityCatalog,
];

const tlonLocalNavSections: db.GroupNavSectionWithRelations[] = [
  {
    index: 0,
    id: 'welcome-zone-id',
    groupId: '~nibset-napwyn/tlon',
    title: 'Welcome',
    coverImage: null,
    coverImageColor: null,
    iconImage: null,
    iconImageColor: null,
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
    coverImageColor: null,
    iconImage: null,
    iconImageColor: null,
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
    coverImageColor: null,
    iconImage: null,
    iconImageColor: null,
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
  coverImage: null,
  coverImageColor: '#000000',
  iconImage: null,
  iconImageColor: '#FFFFFF',
  isJoined: true,
  lastPostAt: null,
  lastPostId: null,
  description: 'Tlon Local',
  members: [
    {
      contactId: '~ravmel-ropdyl',
      joinedAt: 0,
      chatId: '~nibset-napwyn/tlon',
      membershipType: 'group',
    },
    {
      contactId: '~rilfun-lidlen',
      joinedAt: 0,
      chatId: '~nibset-napwyn/tlon',
      membershipType: 'group',
    },
    {
      contactId: '~solfer-magfed',
      joinedAt: 0,
      chatId: '~nibset-napwyn/tlon',
      membershipType: 'group',
    },
    {
      contactId: '~nocsyx-lassul',
      joinedAt: 0,
      chatId: '~nibset-napwyn/tlon',
      membershipType: 'group',
    },
    {
      contactId: '~latter-bolden',
      joinedAt: 0,
      chatId: '~nibset-napwyn/tlon',
      membershipType: 'group',
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

  const content = getRandomFakeContent() as unknown as string;

  return {
    id: `${ship}-${id}`,
    authorId: ship,
    author: fakeContact,
    content,
    sentAt: randomSentAtSameDay,
    replyCount: 0,
    type: 'chat',
    groupId: group.id,
    channelId: tlonLocalIntros.id,
    title: null,
    hasImage: null,
    image: null,
    receivedAt: randomSentAtSameDay,
    textContent: getTextContent(JSON.parse(content)) ?? null,
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

const dates = {
  now: Date.now(),
  earlierToday: Date.now() - 1000 * 60 * 60 * 2,
  yesterday: Date.now() - 1000 * 60 * 60 * 24,
  lastWeek: Date.now() - 1000 * 60 * 60 * 24 * 7,
  lastMonth: Date.now() - 1000 * 60 * 60 * 24 * 30,
};

export const groupWithColorAndNoImage: db.GroupSummary = {
  id: '1',
  title: 'Test Group',
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

export const groupWithLongTitle = {
  ...groupWithColorAndNoImage,
  title: 'And here, a reallly long title, wazzup, ok',
  textContent: 'HIIIIIIIIIII',
  lastPostAt: dates.earlierToday,
  lastPost: {
    ...createFakePost(),
    textContent:
      'This is a line that will be long enough to fill all of the available space.',
  },
};

export const groupWithNoColorOrImage = {
  ...groupWithColorAndNoImage,
  iconImageColor: null,
  lastPost: createFakePost(),
  lastPostAt: dates.yesterday,
  unreadCount: Math.floor(Math.random() * 20),
};

export const groupWithImage = {
  ...groupWithColorAndNoImage,
  iconImage:
    'https://dans-gifts.s3.amazonaws.com/dans-gifts/solfer-magfed/2024.4.6..15.49.54..4a7e.f9db.22d0.e560-IMG_4770.jpg',
  lastPost: createFakePost(),
  lastPostAt: dates.lastWeek,
  unreadCount: Math.floor(Math.random() * 20),
};

export const groupWithSvgImage = {
  ...groupWithColorAndNoImage,
  iconImage: 'https://tlon.io/local-icon.svg',
  lastPost: createFakePost(),
  lastPostAt: dates.lastMonth,
  unreadCount: Math.floor(Math.random() * 20),
};
