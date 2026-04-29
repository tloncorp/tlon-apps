import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { View, YStack, getTokenValue } from 'tamagui';

import { StaticChatMessage } from '../../ChatMessage/StaticChatMessage';
import { buildMockPost } from './buildMockPost';
import {
  INITIAL_VISIBLE_COUNT,
  MESSAGE_REVEAL_DELAY_MS,
  MESSAGE_REVEAL_JITTER_MS,
  MOCK_CONVERSATION,
} from './mockConversation';

// Optical scale: messages render at natural size, then get scaled down so they
// read as a miniature preview. Keep in sync with CONTENT_WIDTH below — a
// phone-sized canvas that looks right at 50% on the splash pane.
const SCALE = 0.5;
const CONTENT_WIDTH = 380;
const CONTENT_HEIGHT = 700;
const BEZEL_PADDING = 1;
const BEZEL_RADIUS = 25;
const SCREEN_RADIUS = BEZEL_RADIUS - BEZEL_PADDING;
const VISIBLE_W = CONTENT_WIDTH * SCALE;
const VISIBLE_H = CONTENT_HEIGHT * SCALE;

// Simulates a scripted user ↔ Tlonbot exchange on the splash "This is a group"
// pane, rendered inside a phone-shaped bezel. Posts reveal progressively to
// give a sense of a live conversation. Uses `StaticChatMessage` so the
// preview looks identical to real chat, then transforms the whole thing down
// to ~50% size.
const DEFAULT_FRIEND_SHIP_ID = '~sampel-palnet';

export function BotChatPreview({
  userShipId,
  botShipId,
  friendShipId = DEFAULT_FRIEND_SHIP_ID,
}: {
  userShipId: string;
  botShipId: string;
  friendShipId?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const scrollRef = useRef<ScrollView>(null);
  // Freeze a base timestamp so sentAt values remain stable across re-renders.
  const baseSentAtRef = useRef(Date.now());

  useEffect(() => {
    if (visibleCount >= MOCK_CONVERSATION.length) return;
    const delay =
      MESSAGE_REVEAL_DELAY_MS + Math.random() * MESSAGE_REVEAL_JITTER_MS;
    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [visibleCount]);

  const posts = useMemo(() => {
    const base = baseSentAtRef.current;
    const shipIds = {
      user: userShipId,
      bot: botShipId,
      friend: friendShipId,
    };
    return MOCK_CONVERSATION.slice(0, visibleCount).map((msg, i) =>
      buildMockPost({
        index: i,
        sender: msg.sender,
        text: msg.text,
        shipIds,
        // Space sentAt out so the chat UI groups consecutive same-author
        // posts correctly (authors are hidden after the first in a run).
        sentAt: base + i * 30_000,
      })
    );
  }, [visibleCount, userShipId, botShipId, friendShipId]);

  return (
    <View flex={1} alignItems="center" justifyContent="center">
      <View
        width={VISIBLE_W + BEZEL_PADDING * 2}
        height={VISIBLE_H + BEZEL_PADDING * 2}
        backgroundColor="$activeBorder"
        borderRadius={BEZEL_RADIUS}
        padding={BEZEL_PADDING}
        shadowColor="$shadow"
        shadowOffset={{ width: 0, height: 12 }}
        shadowOpacity={0.35}
        shadowRadius={24}
        rotate="-3deg"
      >
        <View
          width={VISIBLE_W}
          height={VISIBLE_H}
          borderRadius={SCREEN_RADIUS}
          overflow="hidden"
          backgroundColor="$background"
        >
          <View
            width={CONTENT_WIDTH}
            height={CONTENT_HEIGHT}
            style={{
              transform: [{ scale: SCALE }],
              transformOrigin: 'top left',
            }}
          >
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: getTokenValue('$l', 'size'),
                paddingTop: 40,
                paddingBottom: getTokenValue('$l', 'size'),
                flexGrow: 1,
                justifyContent: 'flex-end',
              }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({ animated: true })
              }
            >
              <YStack gap="$l">
                {posts.map((post, i) => {
                  const prev = posts[i - 1];
                  const showAuthor = !prev || prev.authorId !== post.authorId;
                  return (
                    <StaticChatMessage
                      key={post.id}
                      post={post}
                      showAuthor={showAuthor}
                      hideSentAtTimestamp
                      hideProfilePreview
                    />
                  );
                })}
              </YStack>
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
}
