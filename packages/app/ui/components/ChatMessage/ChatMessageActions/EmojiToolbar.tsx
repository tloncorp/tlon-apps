import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { getNativeEmoji } from '@tloncorp/ui';
import { Button } from '@tloncorp/ui';
import { SizableEmoji } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { XStack } from 'tamagui';

import { useCurrentUserId } from '../../../contexts';
import useOnEmojiSelect from '../../../hooks/useOnEmojiSelect';
import { ReactionDetails, useReactionDetails } from '../../../utils/postUtils';
import { EmojiPickerSheet } from '../../Emoji/EmojiPickerSheet';

const logger = createDevLogger('EmojiToolbar', false);

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

  const lastShortCode =
    details.self.didReact &&
    !['👍', '❤️', '😂', '🌀'].some((code) => details.self.value.includes(code))
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
        <EmojiToolbarButton
          details={details}
          shortCode="+1"
          handlePress={handleToolbarPress}
          testID="EmojiToolbarButton-thumb"
        />
        <EmojiToolbarButton
          details={details}
          shortCode="heart"
          handlePress={handleToolbarPress}
          testID="EmojiToolbarButton-heart"
        />
        <EmojiToolbarButton
          details={details}
          shortCode="laughing"
          handlePress={handleToolbarPress}
          testID="EmojiToolbarButton-laughing"
        />
        <EmojiToolbarButton
          details={details}
          shortCode={lastShortCode}
          handlePress={handleToolbarPress}
          testID="EmojiToolbarButton-last"
        />
        <Button.Frame padding="$xs" borderWidth={0} onPress={handleSheetOpen}>
          <Icon type="ChevronDown" size="$l" />
        </Button.Frame>
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
  return (
    <Button.Frame
      padding="$xs"
      borderWidth={0}
      backgroundColor={
        details.self.didReact && details.self.value.includes(shortCode)
          ? '$positiveBackground'
          : undefined
      }
      onPress={() => handlePress(shortCode)}
      testID={testID}
    >
      <SizableEmoji emojiInput={shortCode} fontSize={32} />
    </Button.Frame>
  );
}
