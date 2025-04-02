import * as db from '@tloncorp/shared/db';
import { PropsWithRef } from 'react';
import React from 'react';
import { Dimensions } from 'react-native';
import { View, YStack } from 'tamagui';

import { useIsWindowNarrow } from '../Emoji';
import MentionPopup, { MentionPopupRef } from '../MentionPopup';

function InputMentionPopupInternal(
  {
    containerHeight,
    showMentionPopup,
    mentionText,
    groupMembers,
    onSelectMention,
  }: PropsWithRef<{
    containerHeight: number;
    showMentionPopup: boolean;
    mentionText?: string;
    groupMembers: db.ChatMember[];
    onSelectMention: (contact: db.Contact) => void;
  }>,
  ref: MentionPopupRef
) {
  const isNarrow = useIsWindowNarrow();
  return showMentionPopup ? (
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
