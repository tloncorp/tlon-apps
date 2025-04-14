import * as db from '@tloncorp/shared/db';
import { PropsWithRef, useEffect } from 'react';
import React from 'react';
import { View, YStack } from 'tamagui';

import { useIsWindowNarrow } from '../Emoji';
import MentionPopup, { MentionPopupRef } from '../MentionPopup';

function InputMentionPopupInternal(
  {
    containerHeight,
    isMentionModeActive,
    mentionText,
    groupMembers,
    onSelectMention,
    setHasMentionCandidates,
  }: PropsWithRef<{
    containerHeight: number;
    isMentionModeActive: boolean;
    mentionText?: string;
    groupMembers: db.ChatMember[];
    onSelectMention: (contact: db.Contact) => void;
    setHasMentionCandidates?: (has: boolean) => void;
  }>,
  ref: MentionPopupRef
) {
  useEffect(() => {
    if (mentionText) {
      const filteredMembers = groupMembers.filter((member) =>
        member.contact?.id.toLowerCase().includes(mentionText.toLowerCase())
      );
      setHasMentionCandidates?.(filteredMembers.length > 0);
    }
  }, [mentionText, groupMembers, setHasMentionCandidates]);

  const isNarrow = useIsWindowNarrow();
  return isMentionModeActive ? (
    <YStack
      position="absolute"
      bottom={containerHeight + 24}
      zIndex={15}
      // borderWidth={2}
      // borderColor="orange"
      width="90%"
      maxWidth={isNarrow ? 'unset' : 500}
    >
      <View position="relative" top={0} left={8}>
        <MentionPopup
          onPress={onSelectMention}
          matchText={mentionText}
          groupMembers={groupMembers}
          ref={ref}
        />
      </View>
    </YStack>
  ) : null;
}

const InputMentionPopup = React.forwardRef(InputMentionPopupInternal);
export default InputMentionPopup;
