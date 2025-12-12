// tamagui-ignore
import * as db from '@tloncorp/shared/db';
import {
  PlaintextPreviewConfig,
  convertContent,
  plaintextPreviewOf,
} from '@tloncorp/shared/logic';
import { RawText, Text } from '@tloncorp/ui';
import React, { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppDataContextProvider,
  ChannelDivider,
  ChatMessage,
  RequestsProvider,
  ScrollView,
  View,
} from '../ui';
import { PostBlockSeparator } from '../ui/components/Channel/Scroller';
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

const ScrollFixture = ({
  postGroups,
  plaintextPreviewConfig,
}: {
  postGroups: PostGroup[];
  plaintextPreviewConfig?: {
    enabled: boolean;
    inline: boolean;
  };
}) => {
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
                <View key={post.id} style={{ position: 'relative' }}>
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

                  {plaintextPreviewConfig?.enabled && (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          background: 'hsla(0, 0%, 100%, 0.8)',
                          outline: '1px solid black',
                          transition: 'opacity 0.2s ease-in-out',
                        },
                      ]}
                      hoverStyle={{ opacity: 0.1 }}
                    >
                      <RawText>
                        {plaintextPreviewOf(
                          convertContent(post.content, post.blob),
                          plaintextPreviewConfig.inline
                            ? PlaintextPreviewConfig.inlineConfig
                            : PlaintextPreviewConfig.defaultConfig
                        )}
                      </RawText>
                    </View>
                  )}
                </View>
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
          label="Failed (showAuthor=true)"
          post={{ ...post, deliveryStatus: 'failed' }}
          onPressRetry={async (p) => {
            alert(`Retry triggered for post: ${p.id}`);
          }}
        />
        <PostSpecimen
          label="Failed (showAuthor=false)"
          post={{ ...post, deliveryStatus: 'failed' }}
          showAuthor={false}
          onPressRetry={async (p) => {
            alert(`Retry triggered for post: ${p.id}`);
          }}
        />
        <PostSpecimen label="Sent" post={{ ...post, deliveryStatus: 'sent' }} />
        <PostSpecimen label="Edited" post={{ ...post, isEdited: true }} />
        <PostSpecimen label="Hidden" post={{ ...post, hidden: true }} />
        <PostSpecimen label="Deleted" post={{ ...post, isDeleted: true }} />
      </View>
    </ChatMessageFixtureWrapper>
  );
};

const PostSpecimen = ({
  label,
  post,
  onPressRetry,
  showAuthor = true,
}: {
  label: string;
  post: db.Post;
  onPressRetry?: (post: db.Post) => Promise<void>;
  showAuthor?: boolean;
}) => {
  return (
    <View padding="$m" gap="$m" backgroundColor={'$secondaryBackground'}>
      <Text size="$label/s">{label}</Text>
      <View backgroundColor={'$background'} borderRadius="$l">
        <ChatMessage
          post={post}
          showAuthor={showAuthor}
          showReplies={true}
          onPressRetry={onPressRetry}
        />
      </View>
    </View>
  );
};

const SearchHighlightFixture = () => {
  const searchPost = makePost(
    exampleContacts.mark,
    [content.verse.inline('This is a message with some text that contains search terms like hello and world.')],
    { replyCount: 0 }
  );
  
  return (
    <ChatMessageFixtureWrapper>
      <View gap="$xl">
        <View>
          <Text size="$label/m" color="$tertiaryText" marginBottom="$s">Search query: "hello"</Text>
          <ChatMessage post={searchPost} showAuthor={true} showReplies={true} searchQuery="hello" />
        </View>
        <View>
          <Text size="$label/m" color="$tertiaryText" marginBottom="$s">Search query: "world"</Text>
          <ChatMessage post={searchPost} showAuthor={true} showReplies={true} searchQuery="world" />
        </View>
        <View>
          <Text size="$label/m" color="$tertiaryText" marginBottom="$s">Search query: "message text"</Text>
          <ChatMessage post={searchPost} showAuthor={true} showReplies={true} searchQuery="message text" />
        </View>
      </View>
    </ChatMessageFixtureWrapper>
  );
};

export default {
  All: (
    <ScrollFixture
      postGroups={scrollPosts}
      plaintextPreviewConfig={{ enabled: false, inline: false }}
    />
  ),
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
  SearchHighlight: <SearchHighlightFixture />,
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
