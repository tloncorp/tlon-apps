import { faker } from '@faker-js/faker';
import { useQuery } from '@tanstack/react-query';
import type { ContentReference, PostContent } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import * as ub from '@tloncorp/shared/dist/urbit';

import {
  createFakePost,
  createFakeReactions,
  group,
  groupWithNoColorOrImage,
  randomContactId,
  tlonLocalBulletinBoard,
  tlonLocalGettingStarted,
  tlonLocalIntros,
} from './fakeData';

export const inline = {
  text: (content: string) => content,
  break: () => ({
    break: null,
  }),
  inlineCode: (content: string) => ({
    'inline-code': content,
  }),
  code: (content: string) => ({
    code: content,
  }),
  blockReference: (index: number, text: string) => ({
    block: {
      index,
      text,
    },
  }),
  link: (href: string, content: string) => ({
    link: {
      href,
      content,
    },
  }),
  bold: (...children: ub.Inline[]) => ({
    bold: children,
  }),
  italics: (...children: ub.Inline[]) => ({
    italics: children,
  }),
  strikethrough: (...children: ub.Inline[]) => ({
    strike: children,
  }),
  blockquote: (...children: ub.Inline[]) => ({
    blockquote: children,
  }),
  ship: (contactId: string) => ({
    ship: contactId,
  }),
} satisfies Record<string, (...args: any[]) => ub.Inline>;

export const listItem = {
  basic: (...children: ub.Inline[]): ub.ListItem => ({
    item: children,
  }),
  task: (checked: boolean, ...children: ub.Inline[]) => ({
    task: {
      checked,
      content: children,
    },
  }),
};

export const verse = {
  block: (content: ub.Block): ub.VerseBlock => {
    return {
      block: content,
    };
  },
  inline: (...children: ub.Inline[]): ub.VerseInline => {
    return {
      inline: children,
    };
  },
};

export const block = {
  image: ({
    width,
    height,
    alt,
    src,
  }: {
    width: number;
    height: number;
    alt: string;
    src: string;
  }) => ({
    block: {
      image: {
        width,
        height,
        alt,
        src,
      },
    },
  }),
  randomImage(width: number, height: number) {
    return this.image({
      width,
      height,
      alt: 'alt',
      src: faker.image.urlLoremFlickr({ width, height, category: 'abstract' }),
    });
  },
  header: (tag: ub.HeaderLevel, ...children: ub.Inline[]) => ({
    block: {
      header: {
        tag,
        content: children,
      },
    },
  }),
  rule: () => ({
    block: {
      rule: null,
    },
  }),
  code: (code: string, language: string) => ({
    block: {
      code: {
        code,
        lang: language,
      },
    },
  }),
  list: (type: ub.ListType, contents: ub.Inline[], items: ub.Listing[]) => ({
    block: {
      listing: list(type, contents, items),
    },
  }),
  channelReference: (channelId: string, postId: string, replyId?: string) => ({
    type: 'reference',
    referenceType: 'channel',
    channelId,
    postId,
    replyId,
  }),
  groupReference: (groupId: string) => ({
    type: 'reference',
    referenceType: 'group',
    groupId,
  }),
  appReference: (appId: string, userId: string) => ({
    type: 'reference',
    referenceType: 'app',
    appId,
    userId,
  }),
} satisfies Record<string, (...args: any[]) => ub.Verse | ContentReference>;

export function list(
  type: ub.ListType,
  contents: ub.Inline[],
  items: ub.Listing[]
) {
  return {
    list: {
      type,
      contents,
      items,
    },
  };
}

export const makePost = (
  contact: db.Contact,
  content: PostContent,
  extra?: any
) => {
  const post = createFakePost('chat', content);
  post.authorId = contact.id;
  post.author = contact;
  return { ...post, reactions: [], ...extra };
};
export const exampleContacts = {
  eleanor: { nickname: 'eleanor', id: randomContactId() },
  mark: { nickname: 'mark', id: randomContactId() },
  ted: { nickname: 'ted', id: randomContactId() },
  met: { nickname: '~met', id: randomContactId() },
  fabledFaster: { nickname: '~fabled-faster', id: randomContactId() },
  pictochatter: { nickname: 'pictochatter', id: randomContactId() },
  palfun: {
    id: '~palfun-foslup',
    color: '#48BC2B',
  },
  emotive: { nickname: 'emotive', id: randomContactId() },
  shrubhead: { nickname: 'Shrubhead333', id: randomContactId() },
  groupAdmin: { nickname: 'Group Admin Guy', id: randomContactId() },
  ed: { nickname: 'ed', id: randomContactId() },
  hooncell: { nickname: 'Hooncel420', id: randomContactId() },
};

export const postWithImage = makePost(
  exampleContacts.eleanor,
  [block.randomImage(317 * 2, 251 * 2)],
  {
    replyCount: 56,
    reactions: createFakeReactions(5, 1, 5),
  }
);

export const postWithText = makePost(exampleContacts.ted, [
  verse.inline(
    'This is a long message. The last message sent in this channel.'
  ),
]);

export const postWithMention = makePost(
  exampleContacts.ted,
  [verse.inline('Ill mention ', inline.ship('~fabled-faster'), ' here')],
  { reactions: createFakeReactions(1, 1, 1), replyCount: 0 }
);

export const postWithBlockquote = makePost(
  exampleContacts.met,
  [
    verse.inline(
      inline.blockquote(
        'This is a block-quoted message, using the > character to annotate text as such such go to next.'
      )
    ),
    verse.inline('This is what he said. Get it?'),
  ],
  {
    replyCount: 0,
    isEdited: true,
  }
);

export const postWithCode = makePost(
  exampleContacts.hooncell,
  [
    verse.inline(
      inline.code(`%-  send
::  forwards compatibility with next-dill
?@  p.kyz  [%txt p.kyz ~]
?:  ?=  %hit  -.p.kyz
[%txt ~]
?.  ?=  %mod  -.p.kyz
p.kyz
=/  =@c
?@  key.p.kyz  key.p.kyz
?:  ?=  ?(%bac %del %ret)  -.key.p.kyz 
  \`@\`-.key.p.kyz
~-
?:  ?=  %met  mod.p.kyz  [%met c]  [%ctl c]`)
    ),
    verse.inline('Does this look correct?'),
  ],
  { replyCount: 0 }
);
export const postWithList = makePost(exampleContacts.hooncell, [
  block.list(
    'ordered',
    ['helo my list!'],
    [
      listItem.basic('one'),
      listItem.basic(faker.lorem.paragraphs(1)),
      listItem.basic('two'),
      list(
        'unordered',
        ['2 deep'],
        [
          listItem.basic('one'),
          listItem.basic('two'),
          listItem.basic(faker.lorem.paragraphs(1)),
        ]
      ),
    ]
  ),
]);
export const referencedChatPost = makePost(
  exampleContacts.palfun,
  [
    verse.inline(
      'This is a normal textual message that’s been referenced and posted elsewhere elsewhere'
    ),
  ],
  {
    channelId: tlonLocalIntros.id,
  }
);

export const postWithLink = makePost(exampleContacts.ed, [
  verse.inline(
    inline.link(
      'https://example.com',
      'checkout this link!! maybe my text could be very long!!'
    )
  ),
]);

export const postWithChatReference = makePost(
  exampleContacts.palfun,
  [
    block.channelReference(tlonLocalIntros.id, referencedChatPost.id),
    verse.inline('Look what I said the other day'),
  ],
  { replyCount: 0 }
);

export const postWithImageAndText = makePost(
  exampleContacts.shrubhead,
  [
    block.randomImage(317 * 2, 326 * 2),
    verse.inline('Check out my shrub view!'),
  ],
  { replyCount: 0 }
);
const referencedGroup = group;

export const postWithGroupReference = makePost(
  exampleContacts.groupAdmin,
  [
    block.groupReference(referencedGroup.id),
    verse.inline('Check out my group here'),
  ],
  { replyCount: 0 }
);
export const postWithGroupReferenceNoAvatar = makePost(
  exampleContacts.groupAdmin,
  [
    block.groupReference(groupWithNoColorOrImage.id),
    verse.inline('Check out my group here'),
  ]
);

export const referencedGalleryPost = makePost(
  exampleContacts.ed,
  [block.randomImage(800, 500)],
  { type: 'block', channelId: tlonLocalBulletinBoard.id }
);
export const postWithGalleryReference = makePost(
  exampleContacts.ed,
  [block.channelReference(tlonLocalBulletinBoard.id, referencedGalleryPost.id)],
  { isEdited: false, replyCount: 0 }
);
export const referencedNotebookPost = makePost(
  exampleContacts.ed,
  [verse.inline(faker.lorem.paragraphs(3))],
  {
    type: 'note',
    title: 'Henri Barbusse',
    channelId: tlonLocalGettingStarted.id,
  }
);
export const postWithNotebookReference = makePost(
  exampleContacts.ed,
  [
    block.channelReference(
      tlonLocalGettingStarted.id,
      referencedNotebookPost.id
    ),
    verse.inline('Check out my notebook here'),
  ],
  { isEdited: false, replyCount: 0 }
);
export const postWithVideo = makePost(exampleContacts.emotive, [
  block.image({
    width: 868,
    alt: 'Screen Recording 2024-08-02 at 9.13.37 AM.mov',
    src: 'https://storage.googleapis.com/tlon-prod-memex-assets/solfer-magfed/solfer-magfed/2024.8.28..21.6.48..978d.4fdf.3b64.05a1-Screen-Recording-2024-08-02-at-9.13.37 AM.mov',
    height: 1660,
  }),
]);

export const postWithDeleted = makePost(exampleContacts.eleanor, [], {
  isDeleted: true,
});

export const postWithHidden = makePost(exampleContacts.eleanor, [], {
  hidden: true,
});

export const postWithEmoji = makePost(exampleContacts.emotive, [
  verse.inline('🙏🤪🥵', inline.break()),
]);

export const postWithSingleEmoji = makePost(exampleContacts.emotive, [
  verse.inline('🙏', inline.break()),
]);

const postsMap: Record<string, db.Post> = Object.fromEntries(
  [referencedGalleryPost, referencedChatPost, referencedNotebookPost].map(
    (p) => [p.id, p]
  )
);

const groupsMap: Record<string, db.Group> = Object.fromEntries(
  [group, groupWithNoColorOrImage].map((g) => [g.id, g])
);

export const usePostReference = ({
  postId,
}: {
  channelId: string;
  postId: string;
  replyId?: string;
}) => useQuery({ queryKey: ['post', postId], queryFn: () => postsMap[postId] });
export const useChannel = ({ id }: { id: string }) =>
  useQuery({
    queryKey: ['channel', id],
    queryFn: () => tlonLocalBulletinBoard,
  });
export const useGroup = (id: string) =>
  useQuery({ queryKey: ['group', id], queryFn: () => groupsMap[id] ?? group });
