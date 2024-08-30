// tamagui-ignore
import { faker } from '@faker-js/faker';
import { useQuery } from '@tanstack/react-query';
import * as db from '@tloncorp/shared/dist/db';
import {
  AppDataContextProvider,
  ChannelDivider,
  ChatMessage,
  RequestsProvider,
  ScrollView,
} from '@tloncorp/ui/src';
import { PostBlockSeparator } from '@tloncorp/ui/src/components/Channel/Scroller';
import React, { PropsWithChildren } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FixtureWrapper } from './FixtureWrapper';
import * as content from './contentHelpers';
import {
  createFakePost,
  createFakeReactions,
  group,
  randomContactId,
  tlonLocalBulletinBoard,
  tlonLocalGettingStarted,
} from './fakeData';

const exampleContacts = {
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

const makePost = (
  contact: db.Contact,
  content: unknown,
  extra?: Partial<db.Post>
) => {
  const post = createFakePost('chat', JSON.stringify(content));
  post.authorId = contact.id;
  post.author = contact;
  return { ...post, reactions: [], ...extra };
};

const postWithImage = makePost(
  exampleContacts.eleanor,
  [content.block.randomImage(317 * 2, 251 * 2)],
  {
    isEdited: true,
    replyCount: 56,
    reactions: createFakeReactions(5, 1, 5),
  }
);

const postWithText = makePost(
  exampleContacts.ted,
  [
    content.verse.inline(
      'This is a long message. The last message sent in this channel.'
    ),
  ],
  { isEdited: true }
);

const postWithMention = makePost(
  exampleContacts.ted,
  [
    content.verse.inline(
      'Ill mention ',
      content.inline.ship('~fabled-faster'),
      ' here'
    ),
  ],
  { reactions: createFakeReactions(1, 1, 1), replyCount: 0 }
);

const postWithBlockquote = makePost(
  exampleContacts.met,
  [
    content.verse.inline(
      content.inline.blockquote(
        'This is a block-quoted message, using the > character to annotate text as such such go to next.'
      )
    ),
    content.verse.inline('This is what he said. Get it?'),
  ],
  {
    replyCount: 0,
    isEdited: true,
  }
);

const postWithCode = makePost(
  exampleContacts.hooncell,
  [
    content.verse.inline(
      content.inline.code(`%-  send
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
    content.verse.inline('Does this look correct?'),
  ],
  { replyCount: 0 }
);

const postWithList = makePost(exampleContacts.hooncell, [
  content.block.list(
    'ordered',
    ['helo my list!'],
    [
      content.listItem.basic('one'),
      content.listItem.basic(faker.lorem.paragraphs(1)),
      content.listItem.basic('two'),
      content.list(
        'unordered',
        ['2 deep'],
        [
          content.listItem.basic('one'),
          content.listItem.basic('two'),
          content.listItem.basic(faker.lorem.paragraphs(1)),
        ]
      ),
    ]
  ),
]);

const referencedChatPost = makePost(exampleContacts.palfun, [
  content.verse.inline(
    'This is a normal textual message that’s been referenced and posted elsewhere elsewhere'
  ),
]);

const postWithChatReference = makePost(
  exampleContacts.palfun,
  [
    content.block.channelReference(
      tlonLocalBulletinBoard.id,
      referencedChatPost.id
    ),
    content.verse.inline('Look what I said the other day'),
  ],
  { replyCount: 0 }
);

const postWithImageAndText = makePost(
  exampleContacts.shrubhead,
  [
    content.block.randomImage(317 * 2, 326 * 2),
    content.verse.inline('Check out my shrub view!'),
  ],
  { replyCount: 0 }
);

const referencedGroup = group;

const postWithGroupReference = makePost(
  exampleContacts.groupAdmin,
  [
    content.block.groupReference(referencedGroup.id),
    content.verse.inline('Check out my group here'),
  ],
  { replyCount: 0 }
);

const referencedGalleryPost = makePost(
  exampleContacts.ed,
  [content.block.randomImage(800, 500)],
  { type: 'block', channelId: tlonLocalBulletinBoard.id }
);

const postWithGalleryReference = makePost(
  exampleContacts.ed,
  [
    content.block.channelReference(
      tlonLocalBulletinBoard.id,
      referencedGalleryPost.id
    ),
  ],
  { isEdited: false, replyCount: 0 }
);

const referencedNotebookPost = makePost(
  exampleContacts.ed,
  [content.verse.inline(faker.lorem.paragraphs(3))],
  {
    type: 'note',
    title: 'Henri Barbusse',
    channelId: tlonLocalGettingStarted.id,
  }
);

const postWithNotebookReference = makePost(
  exampleContacts.ed,
  [
    content.block.channelReference(
      tlonLocalGettingStarted.id,
      referencedNotebookPost.id
    ),
    content.verse.inline('Check out my notebook here'),
  ],
  { isEdited: false, replyCount: 0 }
);

const postWithEmoji = makePost(exampleContacts.emotive, [
  content.verse.inline('🙏🤪🥵'),
]);

const postWithSingleEmoji = makePost(exampleContacts.emotive, [
  content.verse.inline('🙏'),
]);

const postWithVideo = makePost(exampleContacts.emotive, [
  content.block.image({
    width: 868,
    alt: 'Screen Recording 2024-08-02 at 9.13.37 AM.mov',
    src: 'https://storage.googleapis.com/tlon-prod-memex-assets/solfer-magfed/solfer-magfed/2024.8.28..21.6.48..978d.4fdf.3b64.05a1-Screen-Recording-2024-08-02-at-9.13.37 AM.mov',
    height: 1660,
  }),
]);

type PostGroup = { divider: 'date' | 'unread' | 'none'; posts: db.Post[] };

const scrollPosts: PostGroup[] = [
  {
    divider: 'none',
    posts: [postWithImage],
  },
  {
    divider: 'date',
    posts: [
      makePost(
        exampleContacts.mark,
        [content.block.randomImage(317 * 2, 208 * 2)],
        {
          isEdited: true,
          reactions: createFakeReactions(2, 1, 2),
        }
      ),
      makePost(
        exampleContacts.mark,
        [content.block.randomImage(317 * 2, 250 * 2)],
        {
          reactions: [],
          replyCount: 0,
        }
      ),
      postWithText,
      postWithMention,
    ],
  },
  {
    divider: 'date',
    posts: [
      postWithBlockquote,
      makePost(
        exampleContacts.fabledFaster,
        [content.block.randomImage(317 * 2, 100 * 2)],
        {
          reactions: createFakeReactions(8, 1, 8),
        }
      ),
      makePost(
        exampleContacts.pictochatter,
        [content.block.randomImage(317 * 2, 273 * 2)],
        {
          replyCount: 0,
          reactions: createFakeReactions(4, 1, 3),
          isEdited: true,
        }
      ),
      makePost(
        exampleContacts.pictochatter,
        [content.verse.inline('Pictochat is alive...')],
        {
          isEdited: false,
          reactions: [],
          replyCount: 0,
        }
      ),
    ],
  },
  {
    divider: 'unread',
    posts: [postWithChatReference],
  },
  {
    divider: 'date',
    posts: [
      makePost(exampleContacts.emotive, [content.verse.inline('🙏🤪🥵')], {
        replyCount: 0,
      }),
      postWithImageAndText,
      postWithGroupReference,
      postWithGalleryReference,
      makePost(
        exampleContacts.ed,
        [content.verse.inline('This is a wild plate...')],
        { isEdited: false, replyCount: 0 }
      ),
      makePost(
        exampleContacts.ed,
        [content.verse.inline('It inspired a blog post')],
        { isEdited: true, replyCount: 0 }
      ),
      postWithNotebookReference,
      makePost(
        exampleContacts.hooncell,
        [
          content.verse.inline(
            content.inline.ship('~solfer-magfed'),
            ' joined the chat'
          ),
        ],
        { type: 'notice', replyCount: 0 }
      ),
      postWithCode,
      postWithList,
    ],
  },
];

const postsMap: Record<string, db.Post> = Object.fromEntries(
  [referencedGalleryPost, referencedChatPost, referencedNotebookPost].map(
    (p) => [p.id, p]
  )
);

const usePostReference = ({
  postId,
}: {
  channelId: string;
  postId: string;
  replyId?: string;
}) => useQuery({ queryKey: ['post', postId], queryFn: () => postsMap[postId] });

const useChannel = ({ id }: { id: string }) =>
  useQuery({
    queryKey: ['channel', id],
    queryFn: () => tlonLocalBulletinBoard,
  });

const useGroup = (id: string) =>
  useQuery({ queryKey: ['group', id], queryFn: () => group });

function ChatMessageFixtureWrapper({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <FixtureWrapper fillWidth fillHeight>
      <AppDataContextProvider contacts={Object.values(exampleContacts)}>
        {/* @ts-expect-error don't care */}
        <RequestsProvider
          useChannel={useChannel}
          useGroup={useGroup}
          usePostReference={usePostReference}
        >
          <ScrollView
            flex={1}
            contentContainerStyle={{
              paddingTop: insets.top,
              paddingHorizontal: '$m',
            }}
          >
            {children}
          </ScrollView>
        </RequestsProvider>
      </AppDataContextProvider>
    </FixtureWrapper>
  );
}

const ScrollFixture = () => {
  return (
    <ChatMessageFixtureWrapper>
      {scrollPosts.map((p) => {
        return (
          <React.Fragment key="groupWrapper">
            {p.divider !== 'none' ? (
              <React.Fragment key="divider">
                <ChannelDivider
                  key="divider"
                  post={p.posts[0]}
                  unreadCount={p.divider === 'unread' ? 1 : 0}
                />
                <PostBlockSeparator key="separator-div" />
              </React.Fragment>
            ) : null}
            {p.posts.map((post, postIndex) => {
              return (
                <React.Fragment key={post.id}>
                  <ChatMessage
                    post={post}
                    key={post.id}
                    showAuthor={
                      postIndex === 0 ||
                      post.authorId !== p.posts[postIndex - 1]?.authorId
                    }
                    showReplies={true}
                  />
                  {post.authorId !== p.posts[postIndex + 1]?.authorId ||
                  p.posts[postIndex + 1].type === 'notice' ? (
                    <PostBlockSeparator key={'separator-' + post.id} />
                  ) : null}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}
    </ChatMessageFixtureWrapper>
  );
};

const SinglePostFixture = ({ post }: { post: db.Post }) => {
  return (
    <ChatMessageFixtureWrapper>
      <ChatMessage post={post} showAuthor={true} showReplies={true} />
    </ChatMessageFixtureWrapper>
  );
};

export default {
  all: ScrollFixture,
  postWithImage: <SinglePostFixture post={postWithImage} />,
  postWithVideo: <SinglePostFixture post={postWithVideo} />,
  postWithText: <SinglePostFixture post={postWithText} />,
  postWithMention: <SinglePostFixture post={postWithMention} />,
  postWithBlockquote: <SinglePostFixture post={postWithBlockquote} />,
  postWithCode: <SinglePostFixture post={postWithCode} />,
  postWithList: <SinglePostFixture post={postWithList} />,
  postWithChatReference: <SinglePostFixture post={postWithChatReference} />,
  postWithImageAndText: <SinglePostFixture post={postWithImageAndText} />,
  postWithGroupReference: <SinglePostFixture post={postWithGroupReference} />,
  postWithGalleryReference: (
    <SinglePostFixture post={postWithGalleryReference} />
  ),
  postWithNotebookReference: (
    <SinglePostFixture post={postWithNotebookReference} />
  ),
  postWithEmoji: <SinglePostFixture post={postWithEmoji} />,
  postWithSingleEmoji: <SinglePostFixture post={postWithSingleEmoji} />,
};
