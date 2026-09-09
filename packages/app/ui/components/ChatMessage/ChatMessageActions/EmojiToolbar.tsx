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
import {
  LAST_SLOT_PLACEHOLDER,
  resolveSlotEmoji,
  selectFrequentEmojis,
} from './quickEmojis';

const logger = createDevLogger('EmojiToolbar', false);

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
  const native = resolveSlotEmoji(emoji);
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

  const handleFrequentPress = useCallback(
    (slot: string) => {
      if (!getNativeEmoji(slot)) {
        // Slots are either known-good shortcodes or glyphs we recorded from a
        // sent reaction, so an unrecognized one means the validator is too
        // strict. Report it, but still send the glyph rather than eat the tap.
        logger.trackError('No native emoji found', { shortCode: slot });
      }
      handlePress(resolveSlotEmoji(slot));
    },
    [handlePress]
  );

  const usage = db.emojiUsage.useValue();

  const frequentEmojis = useMemo(
    () => selectFrequentEmojis(db.sortEmojisByUsage(usage)),
    [usage]
  );

  const lastShortCode =
    details.self.didReact &&
    ![LAST_SLOT_PLACEHOLDER, ...frequentEmojis].some(
      (code) => resolveSlotEmoji(code) === details.self.value
    )
      ? details.self.value
      : LAST_SLOT_PLACEHOLDER;

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
            handlePress={handleFrequentPress}
            testID={getTestID(shortCode)}
          />
        ))}
        <EmojiToolbarButton
          details={details}
          shortCode={lastShortCode}
          handlePress={handleFrequentPress}
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
  const native = resolveSlotEmoji(shortCode);
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
