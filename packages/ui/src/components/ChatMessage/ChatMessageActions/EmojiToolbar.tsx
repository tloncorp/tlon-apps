import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';

import { XStack } from '../../../core';
import { ReactionDetails, useReactionDetails } from '../../../utils/postUtils';
import { Button } from '../../Button';
import { EmojiPickerSheet } from '../../Emoji/EmojiPickerSheet';
import { SizableEmoji } from '../../Emoji/SizableEmoji';
import { Icon } from '../../Icon';

export function EmojiToolbar({
  post,
  currentUserId,
  onDismiss,
}: {
  post: db.PostWithRelations;
  currentUserId: string;
  onDismiss: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const details = useReactionDetails(post.reactions ?? [], currentUserId);

  const handlePress = useCallback(async (shortCode: string) => {
    details.self.didReact && details.self.value.includes(shortCode)
      ? store.removePostReaction(post, currentUserId)
      : store.addPostReaction(post, shortCode, currentUserId);

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => onDismiss(), 50);
  }, []);

  const lastShortCode =
    details.self.didReact &&
    !['+1', 'heart', 'cyclone', 'seedling'].some((code) =>
      details.self.value.includes(code)
    )
      ? details.self.value
      : 'seedling';

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
          shortCode="cyclone"
          handlePress={handlePress}
        />
        <EmojiToolbarButton
          details={details}
          shortCode={lastShortCode}
          handlePress={handlePress}
        />
        <Button
          padding="$xs"
          borderWidth={0}
          onPress={() => setSheetOpen(true)}
        >
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
