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

export const postWithLongNote = makePost(
  exampleContacts.eleanor,
  [
    verse.inline(
      inline.italics('This week in TestFlight feedback:'),
      inline.break(),
      inline.text(
        "Started out the week with a slim cohort, but throughout the week it's grown into a sizable number of testers—as a result, the feedback has been sporadic and continues to trickle in (enthusiastically). "
      ),
      inline.break(),
      inline.text(
        'Generally, this cohort is excited to use the app, notices the fluidity and speed, and only calls attention to known yet-to-be implemented features related to profiles and reactions.'
      ),
      inline.break(),
      inline.italics(
        "BTW: a little bit of a miscalculation last week. There's still some dissonance between the number of invites sent and number of activations, roughly ten or so. My suspicions about the link escaping containment were premature and I've noted that on the previous bulletin."
      ),
      inline.break(),
      inline.bold('Some numbers:'),
      inline.break()
    ),
    block.list(
      'unordered',
      ["We've sent out invites and installations:"],
      [
        listItem.basic(
          inline.text("We've sent out "),
          inline.bold('90 invites '),
          inline.text('to download the TestFlight on iOS or Android so far'),
          inline.break()
        ),
        listItem.basic(
          inline.bold('79 overall installations'),
          inline.text(' ('),
          inline.bold('60'),
          inline.text(' on iOS and '),
          inline.bold('19'),
          inline.text(' on Android)'),
          inline.break()
        ),
      ]
    ),
    verse.inline(inline.bold('Feedback summary:'), inline.break()),
    block.list(
      'unordered',
      ['Feedback points:'],
      [
        listItem.basic(
          inline.text(
            "As usual, you can read through this week's likes, dislikes and unexpected behaviors "
          ),
          inline.link(
            'https://www.figma.com/board/eSXy0fvDs53SudcQVDSQt0/~2024.7.10-Closed-Alpha-Feedback?node-id=0-1&t=1HYRiNx13KbenB0V-0',
            'here'
          ),
          inline.text('. Bugs are in '),
          inline.link(
            'https://docs.google.com/spreadsheets/d/1mpked9CcOWzs1ndi0AOC3Kz17-6f2MLwrLXz834EVp0/edit?gid=747855318#gid=747855318',
            'this spreadsheet'
          ),
          inline.text('.'),
          inline.break()
        ),
        listItem.basic(
          inline.text(
            'First slowly, then all at once: a few of our testers asked to onboard people in their immediate circles this week, which seems to be a pretty good sign that the app is hitting, especially for nontechnical people. To underline this point, reiterating '
          ),
          inline.ship('~ricsul-bilwyt-dozzod-nisfeb'),
          inline.text(" 's anecdote:"),
          inline.break()
        ),
      ]
    ),
    verse.inline(
      inline.blockquote(
        inline.text(
          "I continue to move real people in my life to Tlon. They like the app, which is something on the OS. They like that they can take control by downloading and running it themselves, which the OS gives them. They like the privacy, security such as it is, data ownership, etc. Basically, they love the OS and the way Tlon lets them use their OS. They do not care about the identity and they immediately set nicknames and never see the ID again. Spam will never be a problem for them because all groups they're in are private. I know a lot of users are still ideological about azimuth and I'm not trying to stir that debate. But having onboarded about 50 people myself azimuth, address space, galaxy/star valuation, network hierarchy, etc hold less than zero interest for normal users. That potential user base appears far larger to me than the one that does care about those aspects, which I believe is already 100% in attendance and not growing."
        ),
        inline.break()
      )
    ),
    block.list(
      'unordered',
      ['Additional feedback points:'],
      [
        listItem.basic(
          inline.text(
            "Worth noting that testers who don't use the current app regularly or at all mentioned a desire to automatically navigate to their most recent messages in a channel."
          ),
          inline.break()
        ),
        listItem.basic(
          inline.text(
            'There seems to be something persistently sticky about notifications in threads and, generally speaking, more than one tester has called attention to the clunkiness of the UX.'
          ),
          inline.break()
        ),
        listItem.basic(
          inline.text(
            'Reactions are important to everyone. They want notifications when their post gets a reaction; they want to know who is reacting to their posts. They (me) want the spacing to be centered, ha.'
          ),
          inline.break()
        ),
        listItem.basic(
          inline.text(
            "I'm sure there's a reason for this that I should already know, but enough people have brought it up that it's worth reconsidering: why can't DM messages be edited?"
          ),
          inline.break()
        ),
        listItem.basic(
          inline.text('Our power tester '),
          inline.ship('~dovsem-bornyl'),
          inline.text(
            " continues to find good bugs, most pertinently, some strange notification behavior: when notifications for group activity are activated, notifications aren't delivering as expected."
          ),
          inline.break()
        ),
      ]
    ),
    verse.inline(inline.bold("What's next?"), inline.break()),
    block.list(
      'unordered',
      ['Next steps:'],
      [
        listItem.basic(
          inline.text('Thank you to '),
          inline.ship('~finned-palmer'),
          inline.text(
            ' for sending a few new testers my way. I sent over download instructions and feedback questions earlier today.'
          ),
          inline.break()
        ),
        listItem.basic(
          inline.text(
            "As noted, many of the testers in this week's cohort were ad hoc, invited through the week, so I'll be fielding those responses as they trickle in (thank you to "
          ),
          inline.ship('~ravmel-ropdyl'),
          inline.text(
            ' for looping many of those contacts in to the TestFlight).'
          ),
          inline.break()
        ),
      ]
    ),
    verse.inline(inline.break()),
  ],
  {
    type: 'note',
    title: '~2024.08.27 Feedback',
    image:
      'https://sfo2.digitaloceanspaces.com/dalwes-migdec/dalwes-migdec/2024.8.27..21.8.40..245a.1cac.0831.26e9-greenish.jpg',
  }
);

export const referencedGalleryPost = makePost(
  exampleContacts.ed,
  [verse.inline(inline.blockquote(faker.lorem.paragraphs(3)))],
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
  [
    referencedGalleryPost,
    referencedChatPost,
    referencedNotebookPost,
    postWithImage,
    postWithText,
    postWithMention,
    postWithBlockquote,
    postWithCode,
    postWithList,
    postWithLink,
    postWithChatReference,
    postWithImageAndText,
    postWithGroupReference,
    postWithGroupReferenceNoAvatar,
    postWithLongNote,
    postWithGalleryReference,
    postWithNotebookReference,
    postWithVideo,
    postWithDeleted,
    postWithHidden,
    postWithEmoji,
    postWithSingleEmoji,
  ].map((p) => [p.id, p])
);

const groupsMap: Record<string, db.Group> = Object.fromEntries(
  [group, groupWithNoColorOrImage].map((g) => [g.id, g])
);

const channelsMap: Record<string, db.Channel> = Object.fromEntries(
  [tlonLocalBulletinBoard, tlonLocalGettingStarted, tlonLocalIntros].map(
    (c) => [c.id, c]
  )
);

export const usePost = (options: { id: string }, initialData?: db.Post) => {
  return useQuery({
    queryKey: ['post', options.id],
    staleTime: Infinity,
    ...(initialData ? { initialData } : {}),
    queryFn: () => initialData ?? postsMap[options.id] ?? null,
  });
};

export const usePostReference = ({
  postId,
}: {
  channelId: string;
  postId: string;
  replyId?: string;
}) =>
  useQuery({
    queryKey: ['post', postId],
    queryFn: () => postsMap[postId] ?? null,
  });

export const useChannel = ({ id }: { id: string }) =>
  useQuery({
    queryKey: ['channel', id],
    queryFn: () => channelsMap[id] ?? tlonLocalGettingStarted,
  });
export const useGroup = (id: string) =>
  useQuery({ queryKey: ['group', id], queryFn: () => groupsMap[id] ?? group });
