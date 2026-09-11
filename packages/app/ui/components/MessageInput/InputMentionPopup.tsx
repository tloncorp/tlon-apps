import { PropsWithRef } from 'react';
import React from 'react';
import { Platform, Pressable } from 'react-native';
import { Portal, View, YStack } from 'tamagui';

import { MentionOption } from '../BareChatInput/useMentions';
import { useIsWindowNarrow } from '../Emoji';
import MentionPopup, { MentionPopupRef } from '../MentionPopup';
import { useInputPopupBottomOffset } from './useInputPopupBottomOffset';

function InputMentionPopupInternal(
  {
    containerHeight,
    inputBarHeight,
    isMentionModeActive,
    mentionText,
    options,
    onSelectMention,
    onDismiss,
  }: PropsWithRef<{
    containerHeight: number;
    // Measured height of the actual input bar, used to stop the mobile
    // dismiss backdrop above a multi-line composer. Falls back to
    // containerHeight (static) when unavailable.
    inputBarHeight?: number;
    isMentionModeActive: boolean;
    mentionText?: string;
    options: MentionOption[];
    onSelectMention: (option: MentionOption) => void;
    onDismiss?: () => void;
  }>,
  ref: MentionPopupRef
) {
  const isNarrow = useIsWindowNarrow();
  const { bottomOffset, backdropBottom } = useInputPopupBottomOffset(
    containerHeight,
    inputBarHeight
  );
  const isMobile = Platform.OS !== 'web';

  if (!isMentionModeActive) return null;

  // On mobile, render in a Portal so the tap-outside backdrop isn't clipped
  // by ancestor View bounds (Android clipChildren defaults to true).
  // MentionPopup itself returns null when options.length === 0, so the
  // backdrop would otherwise catch taps with nothing visible — skip both.
  if (isMobile && options.length > 0) {
    return (
      <Portal>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: backdropBottom,
            }}
          />
        ) : null}
        <View
          position="absolute"
          bottom={bottomOffset}
          left={0}
          right={0}
          alignItems="center"
          pointerEvents="box-none"
        >
          <View
            width="90%"
            maxWidth={isNarrow ? undefined : 500}
            pointerEvents="box-none"
          >
            <MentionPopup
              onPress={onSelectMention}
              matchText={mentionText}
              options={options}
              ref={ref}
            />
          </View>
        </View>
      </Portal>
    );
  }

  return (
    <YStack
      position="absolute"
      bottom={containerHeight + 24}
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
  );
}

const InputMentionPopup = React.forwardRef(InputMentionPopupInternal);
export default InputMentionPopup;
