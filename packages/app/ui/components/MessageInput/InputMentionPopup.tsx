import * as db from '@tloncorp/shared/db';
import { PropsWithRef, useEffect, useState } from 'react';
import React from 'react';
import { Keyboard, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Portal, View, YStack } from 'tamagui';

import { MentionOption } from '../BareChatInput/useMentions';
import { useIsWindowNarrow } from '../Emoji';
import MentionPopup, { MentionPopupRef } from '../MentionPopup';

function useKeyboardHeight() {
  // Read the keyboard state synchronously on mount so the popup positions
  // correctly when the component mounts with the keyboard already visible
  // (e.g. navigating between channels without dismissing the keyboard).
  const [height, setHeight] = useState(() => Keyboard.metrics()?.height ?? 0);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}

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
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const isMobile = Platform.OS !== 'web';

  if (!isMentionModeActive) return null;

  // On mobile, render in a Portal so the tap-outside backdrop isn't clipped
  // by ancestor View bounds (Android clipChildren defaults to true).
  // MentionPopup itself returns null when options.length === 0, so the
  // backdrop would otherwise catch taps with nothing visible — skip both.
  if (isMobile && options.length > 0) {
    // Android uses adjustResize (see AndroidManifest), so the root view
    // already shrinks above the keyboard — a Portal's `bottom: 0` is the
    // keyboard top. On iOS the root does not resize, so we add the
    // keyboard height ourselves.
    const effectiveBottomInset =
      Platform.OS === 'ios' && keyboardHeight > 0
        ? keyboardHeight
        : insets.bottom;
    const bottomOffset = effectiveBottomInset + containerHeight + 24;
    // Backdrop stops just above the real composer (measured, or the static
    // fallback) so taps inside a tall multi-line input still place the
    // cursor instead of dismissing the popup.
    const backdropBottom =
      effectiveBottomInset + (inputBarHeight ?? containerHeight);

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
