import * as db from '@tloncorp/shared/db';
import { PropsWithRef } from 'react';
import React from 'react';
import { View, YStack } from 'tamagui';

import { MentionOption } from '../BareChatInput/useMentions';
import { useIsWindowNarrow } from '../Emoji';
import MentionPopup, { MentionPopupRef } from '../MentionPopup';

function InputMentionPopupInternal(
  {
    containerHeight,
    isMentionModeActive,
    mentionText,
    options,
    onSelectMention,
  }: PropsWithRef<{
    containerHeight: number;
    isMentionModeActive: boolean;
    mentionText?: string;
    options: MentionOption[];
    onSelectMention: (option: MentionOption) => void;
  }>,
  ref: MentionPopupRef
) {
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
          options={options}
          ref={ref}
        />
      </View>
    </YStack>
  ) : null;
}

const InputMentionPopup = React.forwardRef(InputMentionPopupInternal);
export default InputMentionPopup;
