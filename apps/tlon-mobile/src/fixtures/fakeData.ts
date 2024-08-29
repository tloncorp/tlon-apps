import type * as db from '@tloncorp/shared/dist/db';
import { getTextContent } from '@tloncorp/shared/dist/urbit';
import type { Story } from '@tloncorp/shared/dist/urbit/channel';
import { formatUd, unixToDa } from '@urbit/aura';

export const createSimpleContent = (str: string): string => {
  return JSON.stringify([
    {
      inline: [str],
    },
  ] as Story);
};

export const createContentWithMention = (
  str: string,
  contactId: string
): string => {
  const beforeOrAfter = Math.random() < 0.5 ? 'before' : 'after';

  if (beforeOrAfter === 'before') {
    return JSON.stringify([
      {
        inline: [{ ship: contactId }, ' ' + str],
      },
    ] as Story);
  }

  return JSON.stringify([
    {
      inline: [str + ' ', { ship: contactId }],
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

export const createMentionContent = (contactId: string): string => {
  return JSON.stringify([
    {
      inline: [
        {
          ship: contactId,
        },
      ],
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

export const createBlockquoteContent = (str: string, str2?: string): string => {
  return JSON.stringify([
    {
      inline: [
        {
          blockquote: [str],
        },
        str2,
      ],
    },
  ] as Story);
};

//prettier-ignore
const urbitPrefixes = [
  "doz","mar","bin","wan","sam","lit","sig","hid","fid","lis","sog",
  "dir","wac","sab","wis","sib","rig","sol","dop","mod","fog","lid","hop","dar",
  "dor","lor","hod","fol","rin","tog","sil","mir","hol","pas","lac","rov","liv",
  "dal","sat","lib","tab","han","tic","pid","tor","bol","fos","dot","los","dil",
  "for","pil","ram","tir","win","tad","bic","dif","roc","wid","bis","das","mid",
  "lop","ril","nar","dap","mol","san","loc","nov","sit","nid","tip","sic","rop",
  "wit","nat","pan","min","rit","pod","mot","tam","tol","sav","pos","nap","nop",
  "som","fin","fon","ban","mor","wor","sip","ron","nor","bot","wic","soc","wat",
  "dol","mag","pic","dav","bid","bal","tim","tas","mal","lig","siv","tag","pad",
  "sal","div","dac","tan","sid","fab","tar","mon","ran","nis","wol","mis","pal",
  "las","dis","map","rab","tob","rol","lat","lon","nod","nav","fig","nom","nib",
  "pag","sop","ral","bil","had","doc","rid","moc","pac","rav","rip","fal","tod",
  "til","tin","hap","mic","fan","pat","tac","lab","mog","sim","son","pin","lom",
  "ric","tap","fir","has","bos","bat","poc","hac","tid","hav","sap","lin","dib",
  "hos","dab","bit","bar","rac","par","lod","dos","bor","toc","hil","mac","tom",
  "dig","fil","fas","mit","hob","har","mig","hin","rad","mas","hal","rag","lag",
  "fad","top","mop","hab","nil","nos","mil","fop","fam","dat","nol","din","hat",
  "nac","ris","fot","rib","hoc","nim","lar","fit","wal","rap","sar","nal","mos",
  "lan","don","dan","lad","dov","riv","bac","pol","lap","tal","pit","nam","bon",
  "ros","ton","fod","pon","sov","noc","sor","lav","mat","mip","fip"
]

//prettier-ignore
const urbitSuffixes = [
  "zod","nec","bud","wes","sev","per","sut","let","ful","pen","syt",
  "dur","wep","ser","wyl","sun","ryp","syx","dyr","nup","heb","peg","lup","dep",
  "dys","put","lug","hec","ryt","tyv","syd","nex","lun","mep","lut","sep","pes",
  "del","sul","ped","tem","led","tul","met","wen","byn","hex","feb","pyl","dul",
  "het","mev","rut","tyl","wyd","tep","bes","dex","sef","wyc","bur","der","nep",
  "pur","rys","reb","den","nut","sub","pet","rul","syn","reg","tyd","sup","sem",
  "wyn","rec","meg","net","sec","mul","nym","tev","web","sum","mut","nyx","rex",
  "teb","fus","hep","ben","mus","wyx","sym","sel","ruc","dec","wex","syr","wet",
  "dyl","myn","mes","det","bet","bel","tux","tug","myr","pel","syp","ter","meb",
  "set","dut","deg","tex","sur","fel","tud","nux","rux","ren","wyt","nub","med",
  "lyt","dus","neb","rum","tyn","seg","lyx","pun","res","red","fun","rev","ref",
  "mec","ted","rus","bex","leb","dux","ryn","num","pyx","ryg","ryx","fep","tyr",
  "tus","tyc","leg","nem","fer","mer","ten","lus","nus","syl","tec","mex","pub",
  "rym","tuc","fyl","lep","deb","ber","mug","hut","tun","byl","sud","pem","dev",
  "lur","def","bus","bep","run","mel","pex","dyt","byt","typ","lev","myl","wed",
  "duc","fur","fex","nul","luc","len","ner","lex","rup","ned","lec","ryd","lyd",
  "fen","wel","nyd","hus","rel","rud","nes","hes","fet","des","ret","dun","ler",
  "nyr","seb","hul","ryl","lud","rem","lys","fyn","wer","ryc","sug","nys","nyl",
  "lyn","dyn","dem","lux","fed","sed","bec","mun","lyr","tes","mud","nyt","byr",
  "sen","weg","fyr","mur","tel","rep","teg","pec","nel","nev","fes"
]

function pickRandom<T>(arr: T[]) {
  return arr[randInt(0, arr.length)];
}

function randomContactId() {
  return `~${pickRandom(urbitPrefixes)}${pickRandom(urbitSuffixes)}-${pickRandom(urbitPrefixes)}${pickRandom(urbitSuffixes)}`;
}

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
  coverImage:
    'https://d1z5o5vuzqe9y4.cloudfront.net/uploads/39683a_Airy-living-room-at-Castle-Rock-the-Lowell-and-Agnes-Walter-House_Photographs-in-the-Carol-M.-Highsmith-Archive-Library-of-Congress-Prints-and-Photographs-Division.jpg',
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

const basicUnread = {
  type: 'channel',
  count: 10,
  notify: false,
  countWithoutThreads: 5,
  channelId: 'chat/~nibset-napwyn/intros',
  updatedAt: getRandomTimeOnSameDay(),
  firstUnreadPostId: '1',
  firstUnreadPostReceivedAt: getRandomTimeOnSameDay(),
} as const;

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

export const tlonLocalIntros: db.Channel = {
  ...emptyChannel,
  id: 'chat/~nibset-napwyn/intros',
  type: 'chat',
  groupId: '~nibset-napwyn/tlon',
  title: 'Intros',
  description: 'Introduce yourself to the group',
  lastPostId: '1',
  unreadCount: 40,
  unread: basicUnread,
  lastPost: {
    id: '1',
    authorId: '~ravmel-ropdyl',
    content: createSimpleContent('hello'),
    sentAt: 0,
    parentId: null,
    replyCount: 0,
    replyContactIds: null,
    replyTime: null,
    type: 'chat',
    groupId: '~nibset-napwyn/tlon',
    channelId: 'chat/~nibset-napwyn/intros',
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
    hidden: false,
    syncedAt: 0,
  },
};

export const tlonLocalWaterCooler: db.Channel = {
  ...emptyChannel,
  id: '~nibset-napwyn/water-cooler',
  type: 'chat',
  groupId: '~nibset-napwyn/tlon',
  title: 'Internet Cafe',
  description: 'General chat',
  lastPostId: '2',
  unreadCount: 31,
  unread: basicUnread,
  lastPost: {
    id: '2',
    authorId: '~rilfun-lidlen',
    content: createSimpleContent('hey'),
    sentAt: 0,
    parentId: null,
    replyCount: 0,
    replyContactIds: null,
    replyTime: null,
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
    hidden: false,
    syncedAt: 0,
  },
};

export const tlonLocalSupport: db.Channel = {
  ...emptyChannel,
  id: '~nibset-napwyn/support',
  type: 'chat',
  groupId: '~nibset-napwyn/tlon',
  title: 'Support',
  description: 'Get help with Tlon',
  lastPostId: '3',
  unreadCount: 27,
  unread: basicUnread,
  lastPost: {
    id: '3',
    authorId: '~solfer-magfed',
    content: createSimpleContent('sup'),
    sentAt: 0,
    parentId: null,
    replyCount: 0,
    replyContactIds: null,
    replyTime: null,
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
    hidden: false,
    syncedAt: 0,
  },
};

export const tlonLocalBulletinBoard: db.Channel = {
  ...emptyChannel,
  id: '~nibset-napwyn/bulletin-board',
  type: 'gallery',
  groupId: '~nibset-napwyn/tlon',
  title: 'Bulletin Board',
  description: 'Important announcements',
  lastPostId: '4',
  unreadCount: 0,
  unread: basicUnread,
  lastPost: {
    id: '4',
    authorId: '~nocsyx-lassul',
    content: createSimpleContent('yo'),
    sentAt: 0,
    parentId: null,
    replyCount: 0,
    replyContactIds: null,
    replyTime: null,
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
    hidden: false,
    syncedAt: 0,
  },
};

export const tlonLocalCommunityCatalog: db.Channel = {
  ...emptyChannel,
  id: '~nibset-napwyn/community-catalog',
  type: 'gallery',
  groupId: '~nibset-napwyn/tlon',
  title: 'Community Catalog',
  description: 'Find other groups',
  unread: basicUnread,
  lastPostId: '5',
  lastPost: {
    id: '5',
    authorId: '~latter-bolden',
    content: createSimpleContent('lol'),
    sentAt: 0,
    parentId: null,
    replyCount: 0,
    replyContactIds: null,
    replyTime: null,
    type: 'block',
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
    hidden: false,
    syncedAt: 0,
  },
};

export const tlonLocalGettingStarted: db.Channel = {
  ...emptyChannel,
  id: '~nibset-napwyn/getting-started',
  type: 'notebook',
  groupId: '~nibset-napwyn/tlon',
  title: 'Getting Started',
  description: 'Get started with Tlon',
  lastPostId: '6',
  unread: basicUnread,
  lastPost: {
    id: '6',
    authorId: '~ravmel-ropdyl',
    content: createSimpleContent('hi'),
    sentAt: 0,
    parentId: null,
    replyCount: 0,
    replyContactIds: null,
    replyTime: null,
    type: 'note',
    groupId: '~nibset-napwyn/tlon',
    channelId: '~nibset-napwyn/getting-started',
    title: 'Getting Started',
    hasImage: null,
    image: null,
    receivedAt: 0,
    textContent: getTextContent(JSON.parse(createSimpleContent('hi'))) ?? null,
    hasAppReference: null,
    hasChannelReference: null,
    hasGroupReference: null,
    hasLink: null,
    hidden: false,
    syncedAt: 0,
  },
};

const tlonLocalChannels: db.Channel[] = [
  tlonLocalIntros,
  tlonLocalWaterCooler,
  tlonLocalSupport,
  tlonLocalGettingStarted,
  tlonLocalBulletinBoard,
  tlonLocalCommunityCatalog,
];

const tlonLocalNavSections: db.GroupNavSection[] = [
  {
    sectionIndex: 0,
    id: '~nibset-napwyn/tlon-welcome-zone-id',
    sectionId: 'welcome-zone-id',
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
        channelIndex: 1,
        groupNavSectionId: 'welcome-zone-id',
      },
      {
        channelId: tlonLocalGettingStarted.id,
        channelIndex: 0,
        groupNavSectionId: 'welcome-zone-id',
      },
    ],
  },
  {
    sectionIndex: 1,
    id: `~nibset-napwyn/tlon-discuss-zone-id`,
    sectionId: 'discuss-zone-id',
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
        channelIndex: 0,
        groupNavSectionId: 'discuss-zone-id',
      },
      {
        channelId: tlonLocalSupport.id,
        channelIndex: 1,
        groupNavSectionId: 'discuss-zone-id',
      },
    ],
  },
  {
    sectionIndex: 2,
    id: '~nibset-napwyn/tlon-catalog-zone-id',
    sectionId: 'catalog-zone-id',
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
        channelIndex: 0,
        groupNavSectionId: 'catalog-zone-id',
      },
      {
        channelId: tlonLocalCommunityCatalog.id,
        channelIndex: 1,
        groupNavSectionId: 'catalog-zone-id',
      },
    ],
  },
];

export const group: db.Group = {
  id: '~nibset-napwyn/tlon',
  hostUserId: '~nibset-napwyn',
  currentUserIsHost: false,
  title: 'Tlon Local',
  channels: tlonLocalChannels,
  navSections: tlonLocalNavSections,
  roles,
  coverImage: null,
  coverImageColor: '#000000',
  iconImage: 'https://tlon.io/local-icon.svg',
  iconImageColor: '#FFFFFF',
  currentUserIsMember: true,
  lastPostAt: null,
  lastPostId: null,
  description:
    'We’re off building the internet of tomorrow. And we’re not doing it alone. Join us in Tlon Local, where the future is always under construction.',
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
  privacy: 'public',
};

export const fakeStrings: string[] = [
  'yo',
  'hey',
  'lol',
  'sup',
  'hi',
  'hello',
  'howdy',
  'greetings',
  'why?',
  'what?',
  'where?',
  'when?',
  'how?',
  'who?',
  '😧',
  '😨',
  '😩',
  '😪',
  'Officia proident consequat sint et laboris aliquip ipsum ex sit in nulla ullamco veniam. Occaecat laboris ad irure eiusmod dolor. Consectetur velit ad est reprehenderit non pariatur do consequat reprehenderit pariatur eiusmod duis reprehenderit eiusmod aliqua. Non aute excepteur nisi laboris reprehenderit velit minim nulla veniam laboris nostrud cillum. Sit adipisicing laboris Lorem sunt officia fugiat.',
  'Enim labore officia aute eu. Adipisicing officia veniam minim mollit. Consectetur qui duis minim et. Laboris ad sit laboris cillum. Incididunt in in qui officia. Exercitation dolore ad occaecat nulla. Quis cillum laborum minim amet.',
  'Exercitation ex non ad ex. Tempor dolore ad id laborum. Exercitation non minim laborum. Ullamco cillum et sit. Elit laboris est non in. Quis duis laborum minim. Aliquip laborum laborum laborum.',
  'Consectetur est laborum ut. Exercitation sit ad non. Adipisicing irure in laborum. Exercitation laborum laborum ad. Aute labore do in. Exercitation dolor ad laborum. Consectetur in non laborum.',
];

const getRandomFakeContent = () => {
  const fakeTextContent = pickRandom(fakeStrings);

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

  // randomly add a mention
  if (Math.random() < 0.2) {
    return createContentWithMention(fakeTextContent, randomContactId());
  }

  return createSimpleContent(fakeTextContent);
};

const getRandomFakeContact = () => {
  const keys = Object.keys(initialContacts);
  return initialContacts[Math.floor(Math.random() * keys.length)];
};

export const createFakePost = (
  type?: db.PostType,
  content?: string,
  image?: string
): db.Post => {
  const fakeContact = getRandomFakeContact();
  const ship = fakeContact.id;
  // timestamp on same day
  const randomSentAtSameDay = new Date(
    new Date().getTime() - Math.floor(Math.random() * 10000000)
  ).getTime();

  const fakeRandomContent = getRandomFakeContent() as unknown as string;
  const contentOrFake = content ?? fakeRandomContent;
  const fakeImage = image ? createImageContent(image) : null;

  const textContent = getTextContent(JSON.parse(contentOrFake)) ?? null;
  const id = formatUd(unixToDa(randomSentAtSameDay));
  return {
    id: `${id}`,
    authorId: ship,
    author: fakeContact,
    content: image ? fakeImage : contentOrFake,
    sentAt: randomSentAtSameDay,
    ...createFakeReplyMeta(),
    type: type ?? 'chat',
    groupId: group.id,
    channelId: tlonLocalIntros.id,
    title: type === 'note' ? 'Some Note' : null,
    hasImage: null,
    image:
      type === 'note'
        ? 'https://d2w9rnfcy7mm78.cloudfront.net/22598921/original_169ab0e6543007827061859134a0c402.jpg'
        : null,
    parentId: null,
    receivedAt: randomSentAtSameDay,
    textContent,
    hasAppReference: null,
    hasChannelReference: null,
    hasGroupReference: null,
    hasLink: null,
    reactions: createFakeReactions(randInt(0, 10)),
    hidden: false,
    syncedAt: 0,
  };
};

const reactionValues = [
  'broken_heart',
  'heart',
  'yellow_heart',
  'green_heart',
  'blue_heart',
  'purple_heart',
  '100',
  'anger',
];

export const createFakeReactions = (
  count: number,
  contacts?: db.Contact[]
): db.Reaction[] => {
  const reactions = [];
  for (let i = 0; i < count; i++) {
    reactions.push({
      contactId: contacts
        ? contacts[i % contacts.length].id
        : randomContactId(),
      postId: 'fake-post-id',
      value: ':' + reactionValues[randInt(0, reactionValues.length)] + ':',
    });
  }
  return reactions;
};

export const createFakeReplyMeta = () => {
  const replyCount = Math.max(0, randInt(0, 10));
  return {
    replyCount,
    replyTime: getRandomTimeOnSameDay(),
    replyContactIds: Array.from(Array(Math.min(replyCount, 3))).map(() =>
      randomContactId()
    ),
  };
};

function getRandomTimeOnSameDay() {
  return new Date(
    new Date().getTime() - Math.floor(Math.random() * 10000000)
  ).getTime();
}

export const createFakePosts = (
  count: number,
  type?: db.PostType
): db.Post[] => {
  const posts = [];
  for (let i = 0; i < count; i++) {
    posts.push(createFakePost(type));
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

export const groupWithColorAndNoImage: db.Group = {
  id: '1',
  hostUserId: '~nibset-napwyn',
  currentUserIsHost: false,
  title: 'Test Group',
  privacy: 'private',
  unreadCount: 1,
  iconImage: null,
  iconImageColor: '#FF00FF',
  coverImage: null,
  coverImageColor: null,
  description: 'A test group',
  currentUserIsMember: true,
  lastPostId: 'test-post',
  lastPostAt: dates.now,
  lastChannel: tlonLocalSupport.title,
  lastPost: { ...createFakePost() },
};

export const groupWithLongTitle: db.Group = {
  ...groupWithColorAndNoImage,
  title: 'And here, a reallly long title, wazzup, ok',
  lastPostAt: dates.earlierToday,
  lastChannel: tlonLocalSupport.title,
  lastPost: {
    ...createFakePost(),
    textContent:
      'This is a line that will be long enough to fill all of the available space.',
  },
};

export const groupWithNoColorOrImage: db.Group = {
  ...groupWithColorAndNoImage,
  iconImageColor: null,
  lastPost: createFakePost(),
  lastPostAt: dates.yesterday,
  lastChannel: tlonLocalSupport.title,
  unreadCount: Math.floor(Math.random() * 20),
};

export const groupWithImage: db.Group = {
  ...groupWithColorAndNoImage,
  iconImage:
    'https://dans-gifts.s3.amazonaws.com/dans-gifts/solfer-magfed/2024.4.6..15.49.54..4a7e.f9db.22d0.e560-IMG_4770.jpg',
  lastPost: createFakePost(),
  lastPostAt: dates.lastWeek,
  lastChannel: tlonLocalSupport.title,
  unreadCount: Math.floor(Math.random() * 20),
};

export const groupWithSvgImage: db.Group = {
  ...groupWithColorAndNoImage,
  iconImage: 'https://tlon.io/local-icon.svg',
  lastPost: createFakePost(),
  lastPostAt: dates.lastMonth,
  lastChannel: tlonLocalSupport.title,
  unreadCount: Math.floor(Math.random() * 20),
};

function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min));
}
