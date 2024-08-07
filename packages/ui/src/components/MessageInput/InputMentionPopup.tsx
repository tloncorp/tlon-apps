import * as db from '@tloncorp/shared/dist/db';
import { View, YStack } from 'tamagui';

import MentionPopup from '../MentionPopup';

export default function InputMentionPopup({
  containerHeight,
  showMentionPopup,
  mentionText,
  groupMembers,
  onSelectMention,
}: {
  containerHeight: number;
  showMentionPopup: boolean;
  mentionText?: string;
  groupMembers: db.ChatMember[];
  onSelectMention: (contact: db.Contact) => void;
}) {
  return showMentionPopup ? (
    <YStack position="absolute" bottom={containerHeight + 24} zIndex={15}>
      <View position="relative" top={0} left={8}>
        <MentionPopup
          onPress={onSelectMention}
          matchText={mentionText}
          groupMembers={groupMembers}
        />
      </View>
    </YStack>
  ) : null;
}
