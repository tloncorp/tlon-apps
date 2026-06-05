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
    frameless = false,
  }: PropsWithRef<{
    containerHeight: number;
    isMentionModeActive: boolean;
    mentionText?: string;
    options: MentionOption[];
    onSelectMention: (option: MentionOption) => void;
    frameless?: boolean;
  }>,
  ref: MentionPopupRef
) {
  const isNarrow = useIsWindowNarrow();
  return isMentionModeActive ? (
    <YStack
      position="absolute"
      // The chat input is a short bottom bar, so the popup offsets by the input
      // height to sit just above it. The frameless notebook editor instead fills
      // the screen and `containerHeight` tracks its growing content height, so
      // anchor near the container's bottom (above the keyboard) there.
      bottom={frameless ? 24 : containerHeight + 24}
      zIndex={15}
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
