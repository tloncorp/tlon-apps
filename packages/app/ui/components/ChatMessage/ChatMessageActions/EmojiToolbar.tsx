import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { getNativeEmoji } from '@tloncorp/ui';
import { SizableEmoji } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { XStack } from 'tamagui';

import { useCurrentUserId } from '../../../contexts/appDataContext';
import useOnEmojiSelect from '../../../hooks/useOnEmojiSelect';
import { ReactionDetails, useReactionDetails } from '../../../utils/postUtils';
import { EmojiPickerSheet } from '../../Emoji/EmojiPickerSheet';

const logger = createDevLogger('EmojiToolbar', false);

/** Number of slots given to the user's most-used emoji. */
const FREQUENT_SLOT_COUNT = 3;

/** Fills the frequent slots until the user has enough reaction history. */
const DEFAULT_QUICK_EMOJIS = ['+1', 'heart', 'laughing'];

/**
 * Keeps testIDs tied to emoji identity rather than slot position, since the
 * frequent slots reorder as usage changes.
 */
const TEST_ID_NAMES: Record<string, string> = {
  '+1': 'thumb',
  heart: 'heart',
  laughing: 'laughing',
};

function getTestID(emoji: string) {
  const native = getNativeEmoji(emoji) ?? emoji;
  const named = Object.keys(TEST_ID_NAMES).find(
    (code) => getNativeEmoji(code) === native
  );
  return `EmojiToolbarButton-${named ? TEST_ID_NAMES[named] : native}`;
}

export function EmojiToolbar({
  post,
  onDismiss,
  openExternalSheet,
}: {
  post: db.Post;
  onDismiss: () => void;
  openExternalSheet?: (open: boolean) => void;
}) {
  const currentUserId = useCurrentUserId();
  const [sheetOpen, setSheetOpen] = useState(false);
  const details = useReactionDetails(post.reactions ?? [], currentUserId);

  const handlePress = useOnEmojiSelect(post, onDismiss);

  const handleToolbarPress = useCallback(
    (shortCode: string) => {
      const nativeEmoji = getNativeEmoji(shortCode);
      if (!nativeEmoji) {
        logger.trackError(`No native emoji found`, { shortCode });
        return;
      }
      handlePress(nativeEmoji);
    },
    [handlePress]
  );

  const usage = db.emojiUsage.useValue();

  const frequentEmojis = useMemo(() => {
    const seen = new Set<string>();
    const slots: string[] = [];
    const take = (emoji: string) => {
      const native = getNativeEmoji(emoji);
      if (!native || seen.has(native)) {
        return;
      }
      seen.add(native);
      slots.push(emoji);
    };

    db.sortEmojisByUsage(usage).forEach(take);
    // Backfill any unused slots so the toolbar is never short.
    DEFAULT_QUICK_EMOJIS.forEach(take);

    return slots.slice(0, FREQUENT_SLOT_COUNT);
  }, [usage]);

  const lastShortCode =
    details.self.didReact &&
    !['🌀', ...frequentEmojis].some(
      (code) => getNativeEmoji(code) === details.self.value
    )
      ? details.self.value
      : '🌀';

  const handleSheetOpen = useCallback(() => {
    if (openExternalSheet) {
      // Use external sheet (parent component manages the emoji picker)
      // This avoids z-index conflicts by rendering outside ChatMessageActions
      openExternalSheet(true);
      return;
    }
    // Fallback: use local sheet state (rare case when no external sheet provided)
    setSheetOpen(true);
  }, [setSheetOpen, openExternalSheet]);

  return (
    <>
      <XStack
        padding="$l"
        backgroundColor="$background"
        borderRadius="$l"
        justifyContent="space-between"
        alignItems="center"
        width={256}
      >
        {frequentEmojis.map((shortCode) => (
          <EmojiToolbarButton
            key={shortCode}
            details={details}
            shortCode={shortCode}
            handlePress={handleToolbarPress}
            testID={getTestID(shortCode)}
          />
        ))}
        <EmojiToolbarButton
          details={details}
          shortCode={lastShortCode}
          handlePress={handleToolbarPress}
          testID="EmojiToolbarButton-last"
        />
        <Pressable padding="$xs" onPress={handleSheetOpen}>
          <Icon type="ChevronDown" size="$l" />
        </Pressable>
      </XStack>
      <EmojiPickerSheet
        open={sheetOpen}
        onOpenChange={() => setSheetOpen(false)}
        onEmojiSelect={handlePress}
      />
    </>
  );
}

function EmojiToolbarButton({
  shortCode,
  details,
  handlePress,
  testID,
}: {
  shortCode: string;
  details: ReactionDetails;
  handlePress: (shortCode: string) => void;
  testID: string;
}) {
  // Reactions are stored as native glyphs, so a shortcode slot has to be
  // resolved before it can be compared against the user's reaction. The match
  // must be exact — a substring check would light up 👍 for a 👍🏽 reaction, or
  // ❤️ for ❤️‍🔥, which tapping then replaces rather than removes.
  const native = getNativeEmoji(shortCode) ?? shortCode;
  return (
    <Pressable
      padding="$xs"
      backgroundColor={
        details.self.didReact && details.self.value === native
          ? '$positiveBackground'
          : undefined
      }
      onPress={() => handlePress(shortCode)}
      testID={testID}
    >
      <SizableEmoji emojiInput={shortCode} fontSize={32} />
    </Pressable>
  );
}
