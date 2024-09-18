// tamagui-ignore
import * as db from '@tloncorp/shared/dist/db';
import {
  AppDataContextProvider,
  ChannelDivider,
  ChatMessage,
  RequestsProvider,
  ScrollView,
  View,
} from '@tloncorp/ui/src';
import { PostBlockSeparator } from '@tloncorp/ui/src/components/Channel/Scroller';
import { Text } from '@tloncorp/ui/src/components/TextV2';
import React, { PropsWithChildren } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FixtureWrapper } from './FixtureWrapper';
import * as content from './contentHelpers';
import {
  exampleContacts,
  makePost,
  postWithBlockquote,
  postWithChatReference,
  postWithCode,
  postWithDeleted,
  postWithEmoji,
  postWithGalleryReference,
  postWithGroupReference,
  postWithHidden,
  postWithImage,
  postWithImageAndText,
  postWithList,
  postWithMention,
  postWithNotebookReference,
  postWithSingleEmoji,
  postWithText,
  postWithVideo,
  useChannel,
  useGroup,
  usePostReference,
} from './contentHelpers';
import { createFakeReactions } from './fakeData';

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
          reactions: createFakeReactions({
            count: 2,
            minTotal: 1,
            maxTotal: 2,
          }),
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
          reactions: createFakeReactions({
            count: 8,
            minTotal: 1,
            maxTotal: 8,
          }),
        }
      ),
      makePost(
        exampleContacts.pictochatter,
        [content.block.randomImage(317 * 2, 273 * 2)],
        {
          replyCount: 0,
          reactions: createFakeReactions({
            count: 4,
            minTotal: 1,
            maxTotal: 3,
          }),
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

function ChatMessageFixtureWrapper({
  children,
  backgroundColor,
}: PropsWithChildren<{ backgroundColor?: any }>) {
  const insets = useSafeAreaInsets();
  return (
    <FixtureWrapper
      fillWidth
      fillHeight
      innerBackgroundColor={backgroundColor}
      backgroundColor={backgroundColor}
    >
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

const ScrollFixture = ({ postGroups }: { postGroups: PostGroup[] }) => {
  return (
    <ChatMessageFixtureWrapper>
      {postGroups.map((p, i) => {
        return (
          <React.Fragment key={'groupWrapper-' + i}>
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

const PostVariantsFixture = ({ post }: { post: db.Post }) => {
  return (
    <ChatMessageFixtureWrapper backgroundColor="$secondaryBackground">
      <View padding="$m" gap="$m">
        <PostSpecimen label="Default" post={post} />
        <PostSpecimen
          label="Pending"
          post={{ ...post, deliveryStatus: 'pending' }}
        />
        <PostSpecimen
          label="Failed"
          post={{ ...post, deliveryStatus: 'failed' }}
        />
        <PostSpecimen label="Sent" post={{ ...post, deliveryStatus: 'sent' }} />
        <PostSpecimen label="Edited" post={{ ...post, isEdited: true }} />
        <PostSpecimen label="Hidden" post={{ ...post, hidden: true }} />
        <PostSpecimen label="Deleted" post={{ ...post, isDeleted: true }} />
      </View>
    </ChatMessageFixtureWrapper>
  );
};

const PostSpecimen = ({ label, post }: { label: string; post: db.Post }) => {
  return (
    <View padding="$m" gap="$m" backgroundColor={'$secondaryBackground'}>
      <Text size="$label/s">{label}</Text>
      <View backgroundColor={'$background'} borderRadius="$l">
        <ChatMessage post={post} showAuthor={true} showReplies={true} />
      </View>
    </View>
  );
};

export default {
  All: <ScrollFixture postGroups={scrollPosts} />,
  References: (
    <ScrollFixture
      postGroups={[
        {
          divider: 'none',
          posts: [
            postWithChatReference,
            postWithGroupReference,
            postWithGalleryReference,
            postWithNotebookReference,
          ],
        },
      ]}
    />
  ),
  MessageStates: <PostVariantsFixture post={postWithText} />,
  Image: <SinglePostFixture post={postWithImage} />,
  Video: <SinglePostFixture post={postWithVideo} />,
  Text: <SinglePostFixture post={postWithText} />,
  Mention: <SinglePostFixture post={postWithMention} />,
  Blockquote: <SinglePostFixture post={postWithBlockquote} />,
  Code: <SinglePostFixture post={postWithCode} />,
  List: <SinglePostFixture post={postWithList} />,
  ChatReference: <SinglePostFixture post={postWithChatReference} />,
  ImageAndText: <SinglePostFixture post={postWithImageAndText} />,
  GroupReference: <SinglePostFixture post={postWithGroupReference} />,
  GalleryReference: <SinglePostFixture post={postWithGalleryReference} />,
  NotebookReference: <SinglePostFixture post={postWithNotebookReference} />,
  Emoji: <SinglePostFixture post={postWithEmoji} />,
  SingleEmoji: <SinglePostFixture post={postWithSingleEmoji} />,
  Deleted: <SinglePostFixture post={postWithDeleted} />,
  Hidden: <SinglePostFixture post={postWithHidden} />,
};
