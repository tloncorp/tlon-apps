import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { Button } from '@tloncorp/ui';
import { SizableEmoji } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { XStack } from 'tamagui';

import { useCurrentUserId } from '../../../contexts';
import useOnEmojiSelect from '../../../hooks/useOnEmojiSelect';
import { ReactionDetails, useReactionDetails } from '../../../utils/postUtils';
import { EmojiPickerSheet } from '../../Emoji/EmojiPickerSheet';

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
  const isWindowNarrow = useIsWindowNarrow();

  const handlePress = useOnEmojiSelect(post, onDismiss);

  const lastShortCode =
    details.self.didReact &&
    !['+1', 'heart', 'laughing', 'cyclone'].some((code) =>
      details.self.value.includes(code)
    )
      ? details.self.value
      : 'cyclone';

  const handleSheetOpen = useCallback(() => {
    if (openExternalSheet && !isWindowNarrow) {
      openExternalSheet(true);
      return;
    }
    setSheetOpen(true);
  }, [setSheetOpen, openExternalSheet, isWindowNarrow]);

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
          handlePress={handlePress}
        />
        <EmojiToolbarButton
          details={details}
          shortCode="heart"
          handlePress={handlePress}
        />
        <EmojiToolbarButton
          details={details}
          shortCode="laughing"
          handlePress={handlePress}
        />
        <EmojiToolbarButton
          details={details}
          shortCode={lastShortCode}
          handlePress={handlePress}
        />
        <Button padding="$xs" borderWidth={0} onPress={handleSheetOpen}>
          <Icon type="ChevronDown" size="$l" />
        </Button>
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
}: {
  shortCode: string;
  details: ReactionDetails;
  handlePress: (shortCode: string) => void;
}) {
  return (
    <Button
      padding="$xs"
      borderWidth={0}
      backgroundColor={
        details.self.didReact && details.self.value.includes(shortCode)
          ? '$positiveBackground'
          : undefined
      }
      onPress={() => handlePress(shortCode)}
    >
      <SizableEmoji shortCode={shortCode} fontSize={32} />
    </Button>
  );
}
