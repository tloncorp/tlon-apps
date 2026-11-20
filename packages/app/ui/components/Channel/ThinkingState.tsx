import type * as db from '@tloncorp/shared/db';
import { Text, mobileTypeStyles } from '@tloncorp/ui';
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { AnimatePresence, Spinner, View, XStack } from 'tamagui';

import { ContactAvatar } from '../Avatar';
import { useThinkingIndicator } from './useThinkingIndicator';

const MAX_VISIBLE_AVATARS = 3;
const MIN_ROW_HEIGHT = 52;
// Mobile `$label/m` line height; the desktop variant is shorter.
const LABEL_LINE_HEIGHT = mobileTypeStyles['$label/m'].lineHeight;
const ROW_VERTICAL_PADDING = MIN_ROW_HEIGHT - 2 * LABEL_LINE_HEIGHT;

export function ThinkingState({
  conversationId,
  channelType,
  latestPostId,
  latestPostAuthorId,
  forcedLabel,
}: {
  conversationId: string;
  channelType: db.Channel['type'];
  latestPostId?: string;
  latestPostAuthorId?: string;
  forcedLabel?: string;
}) {
  const { visible, label, computingState } = useThinkingIndicator({
    conversationId,
    latestPostId,
    latestPostAuthorId,
    forcedLabel,
  });
  const { fontScale } = useWindowDimensions();
  // The two-line label must fit at accessibility font scales; the height only
  // changes when the font scale does, never with the label.
  const rowHeight = useMemo(
    () =>
      Math.max(
        MIN_ROW_HEIGHT,
        Math.ceil(2 * LABEL_LINE_HEIGHT * fontScale) + ROW_VERTICAL_PADDING
      ),
    [fontScale]
  );

  const showAvatars = Boolean(
    computingState && (channelType !== 'dm' || computingState.ships.length >= 2)
  );
  const visibleShips =
    computingState?.ships.slice(0, MAX_VISIBLE_AVATARS) ?? [];
  const overflowCount =
    (computingState?.ships.length ?? 0) - visibleShips.length;

  // Keep the footer mounted so presence changes do not replace the FlatList
  // footer in one frame. When a response arrives, remove its height in the same
  // render that adds the post; otherwise the list first closes this gap and
  // then scrolls again for the new row, producing a visible two-step bounce.
  return (
    <View
      accessibilityElementsHidden={!visible}
      height={visible ? rowHeight : 0}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      justifyContent="center"
      opacity={visible ? 1 : 0}
      overflow="hidden"
      paddingHorizontal="$l"
      pointerEvents="none"
    >
      {visible ? (
        <XStack alignItems="center" gap="$s">
          {showAvatars && (
            <XStack alignItems="center">
              <AnimatePresence>
                {visibleShips.map((shipState, index) => (
                  <View
                    key={shipState.ship}
                    transition="quick"
                    scale={1}
                    opacity={1}
                    enterStyle={{ scale: 0.5, opacity: 0 }}
                    exitStyle={{ scale: 0.5, opacity: 0 }}
                    marginLeft={index === 0 ? 0 : -6}
                    zIndex={visibleShips.length - index}
                  >
                    <ContactAvatar contactId={shipState.ship} size="$xl" />
                  </View>
                ))}
              </AnimatePresence>
              {overflowCount > 0 && (
                <Text size="$label/s" color="$tertiaryText" marginLeft="$xs">
                  +{overflowCount}
                </Text>
              )}
            </XStack>
          )}
          <Spinner size="small" color="$tertiaryText" />
          <Text
            size="$label/m"
            color="$tertiaryText"
            flexShrink={1}
            numberOfLines={2}
          >
            {label}
          </Text>
        </XStack>
      ) : null}
    </View>
  );
}
