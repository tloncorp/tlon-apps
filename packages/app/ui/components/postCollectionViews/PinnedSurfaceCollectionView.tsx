import { parsePostBlob } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { getPinnedPostId } from '@tloncorp/shared/logic';
import { Icon, Text } from '@tloncorp/ui';
import { forwardRef, useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Spinner, View, XStack, YStack } from 'tamagui';

import { useLivePost } from '../../../hooks/useLivePost';
import {
  PostCollectionContext,
  usePostCollectionContext,
} from '../../contexts/postCollection';
import { usePostA2UIActions } from '../../hooks/usePostA2UIActions';
import { useConversationComputingState } from '../Channel/useConversationComputingState';
import { A2UIBlock } from '../PostContent/A2UIBlock';
import { ContentContext, usePostContent } from '../PostContent/contentUtils';
import { ListPostCollection } from './ListPostCollectionView';
import { IPostCollectionView } from './shared';

/** Height of the collapsed chat handle docked at the bottom of the surface. */
const CHAT_HANDLE_HEIGHT = 56;

function carriesInteractiveSurface(post: db.Post): boolean {
  if (!post.blob || post.isDeleted) {
    return false;
  }
  try {
    const entries = parsePostBlob(post.blob);
    // Both halves must be present: the surface entry alone is data with no
    // view, and an a2ui entry alone is a plain in-stream card. The canvas
    // only pins a post it can actually draw.
    return (
      entries.some((entry) => entry.type === 'interactive-surface') &&
      entries.some((entry) => entry.type === 'a2ui')
    );
  } catch {
    return false;
  }
}

/**
 * The post the surface shows: the channel's pinned post when it is loaded
 * and carries a surface, else the newest loaded post that does. The
 * heuristic exists because nothing pins the card automatically today — the
 * agent posts it and edits it in place, so "the newest surface post" is the
 * current card by construction, and a genuinely pinned post simply wins.
 */
export function selectSurfacePost(
  posts: db.Post[] | null | undefined,
  channel: db.Channel
): db.Post | null {
  if (posts == null || posts.length === 0) {
    return null;
  }
  const pinnedId = getPinnedPostId(channel);
  if (pinnedId != null) {
    const pinned = posts.find((post) => post.id === pinnedId);
    if (pinned != null && carriesInteractiveSurface(pinned)) {
      return pinned;
    }
  }
  let newest: db.Post | null = null;
  for (const post of posts) {
    if (!carriesInteractiveSurface(post)) {
      continue;
    }
    if (newest == null || (post.receivedAt ?? 0) > (newest.receivedAt ?? 0)) {
      newest = post;
    }
  }
  return newest;
}

/** The newest conversation post, for the collapsed handle's preview line. */
export function selectLatestChatPost(
  posts: db.Post[] | null | undefined,
  excludeId: string
): db.Post | null {
  if (posts == null) {
    return null;
  }
  let newest: db.Post | null = null;
  for (const post of posts) {
    if (post.id === excludeId || post.isDeleted) {
      continue;
    }
    if (newest == null || (post.receivedAt ?? 0) > (newest.receivedAt ?? 0)) {
      newest = post;
    }
  }
  return newest;
}

/**
 * The mini-app itself: the surface post's a2ui tree rendered full bleed — no
 * author row, no timestamp, no message chrome, no card border — with its
 * buttons wired exactly as they are in chat. The post is read live, so the
 * agent's in-place edits re-render the canvas as they sync.
 */
function SurfaceCanvas({ post }: { post: db.Post }) {
  const livePost = useLivePost(post);
  const { onA2UIAction, isA2UIActionAvailable, getA2UIActionState } =
    usePostA2UIActions(livePost);
  const content = usePostContent(livePost);
  const blocks = useMemo(
    () => content.filter((block) => block.type === 'a2ui'),
    [content]
  );
  if (blocks.length === 0) {
    return null;
  }
  return (
    <ContentContext.Provider
      onA2UIAction={onA2UIAction}
      isA2UIActionAvailable={isA2UIActionAvailable}
      getA2UIActionState={getA2UIActionState}
    >
      {blocks.map((block, index) => (
        <A2UIBlock key={index} block={block} fullBleed />
      ))}
    </ContentContext.Provider>
  );
}

/**
 * A kit channel as an app first and a conversation second: the surface post's
 * UI owns the whole channel body, and the chat is a sheet that slides up over
 * it from a docked handle — the app is what you use, the conversation is the
 * programming interface you pull up when you want to steer the agent. The
 * composer stays docked beneath (it belongs to the channel, not this view),
 * so you can talk to the agent even with the transcript sheet closed.
 * With no surface post loaded this is exactly the chat list. See
 * docs/tlon-apps/channel-views.md for how a channel declares this view and
 * how clients without it degrade.
 */
export const PinnedSurfaceCollection: IPostCollectionView = forwardRef(
  function PinnedSurfaceCollection(_props, forwardedRef) {
    const ctx = usePostCollectionContext();
    const [chatOpen, setChatOpen] = useState(false);
    const computingState = useConversationComputingState(ctx.channel.id);
    // On native the composer floats over this whole area (web keeps it in
    // normal flow below), so the sheet docks above the floating chrome
    // rather than behind it.
    const bottomInset = ctx.contentInsets?.bottom ?? 0;
    const surfacePost = useMemo(
      () => selectSurfacePost(ctx.posts, ctx.channel),
      [ctx.posts, ctx.channel]
    );
    const latestChatPost = useMemo(
      () =>
        surfacePost == null
          ? null
          : selectLatestChatPost(ctx.posts, surfacePost.id),
      [ctx.posts, surfacePost]
    );
    const flowingCtx = useMemo(
      () =>
        surfacePost == null
          ? ctx
          : {
              ...ctx,
              posts: ctx.posts?.filter((post) => post.id !== surfacePost.id),
              // The sheet's own geometry already clears the floating composer
              // and the header; the channel-level insets would double up as a
              // dead band under the newest message.
              contentInsets: { top: 0, bottom: 0 },
            },
      [ctx, surfacePost]
    );
    if (surfacePost == null) {
      return <ListPostCollection ref={forwardedRef} />;
    }
    return (
      <View flex={1}>
        <ScrollView
          contentContainerStyle={{
            paddingBottom: CHAT_HANDLE_HEIGHT + bottomInset + 12,
          }}
        >
          <SurfaceCanvas post={surfacePost} />
        </ScrollView>

        {bottomInset > 0 ? (
          // Native: the floating composer hovers over this area, and the
          // area itself reaches the screen bottom — so the panel continues
          // beneath the handle, behind the composer, down to the edge. The
          // input floats inside the panel instead of outside it. (Web has
          // no floating composer; the Channel chrome carries the edges.)
          <View
            position="absolute"
            left="$l"
            right="$l"
            bottom={0}
            height={bottomInset}
            backgroundColor="$background"
            borderLeftWidth={1}
            borderRightWidth={1}
            borderColor="$border"
            pointerEvents="none"
          />
        ) : null}
        <YStack
          position="absolute"
          left="$l"
          right="$l"
          bottom={bottomInset}
          top={chatOpen ? '12%' : undefined}
          height={chatOpen ? undefined : CHAT_HANDLE_HEIGHT}
          backgroundColor="$background"
          borderTopLeftRadius="$2xl"
          borderTopRightRadius="$2xl"
          borderWidth={1}
          borderBottomWidth={0}
          borderColor="$border"
          shadowColor="$shadow"
          shadowOffset={{ width: 0, height: -2 }}
          shadowRadius={8}
          overflow="hidden"
        >
          <Pressable
            onPress={() => setChatOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={
              chatOpen ? 'Close the conversation' : 'Open the conversation'
            }
          >
            <YStack
              height={CHAT_HANDLE_HEIGHT}
              paddingHorizontal="$xl"
              justifyContent="center"
              gap="$xs"
            >
              <View
                alignSelf="center"
                width={36}
                height={4}
                borderRadius={2}
                backgroundColor="$border"
              />
              <XStack alignItems="center" gap="$m">
                <Icon
                  type={chatOpen ? 'ChevronDown' : 'ChevronUp'}
                  customSize={[16, 16]}
                  color="$tertiaryText"
                />
                {latestChatPost ? (
                  <Text
                    size="$label/m"
                    color="$secondaryText"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    textAlign="left"
                    flex={1}
                  >
                    {latestChatPost.authorId}:{' '}
                    {latestChatPost.textContent?.trim() || '…'}
                  </Text>
                ) : (
                  <Text size="$label/m" color="$tertiaryText" flex={1}>
                    Conversation
                  </Text>
                )}
                {computingState ? (
                  <XStack alignItems="center" gap="$s" flexShrink={0}>
                    <Spinner size="small" color="$tertiaryText" />
                    <Text size="$label/m" color="$tertiaryText">
                      {computingState.label}
                    </Text>
                  </XStack>
                ) : null}
              </XStack>
            </YStack>
          </Pressable>
          {chatOpen ? (
            <View flex={1} minHeight={0}>
              <PostCollectionContext.Provider value={flowingCtx}>
                <ListPostCollection ref={forwardedRef} />
              </PostCollectionContext.Provider>
            </View>
          ) : null}
        </YStack>
      </View>
    );
  }
);
