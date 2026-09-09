import type { SlashCommandOption } from '@tloncorp/shared/domain';
import React, { PropsWithRef } from 'react';
import { Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Portal, View, YStack } from 'tamagui';

import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useIsWindowNarrow } from '../Emoji';
import SlashCommandPopup, {
  type SlashCommandController,
} from '../SlashCommandPopup';

function InputSlashCommandPopupInternal(
  {
    containerHeight,
    inputBarHeight,
    isSlashCommandModeActive,
    options,
    onSelectSlashCommand,
    onDismiss,
  }: PropsWithRef<{
    containerHeight: number;
    // Measured height of the actual input bar, used to stop the mobile
    // dismiss backdrop above a multi-line composer. Falls back to
    // containerHeight (static) when unavailable.
    inputBarHeight?: number;
    isSlashCommandModeActive: boolean;
    options: SlashCommandOption[];
    onSelectSlashCommand: (option: SlashCommandOption) => void;
    onDismiss?: () => void;
  }>,
  ref: React.ForwardedRef<SlashCommandController>
) {
  const isNarrow = useIsWindowNarrow();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const isMobile = Platform.OS !== 'web';

  if (!isSlashCommandModeActive || options.length === 0) {
    return null;
  }

  // Match the native mention-popup path: render in a Portal so Android
  // ancestor clipping cannot hide the list and taps outside can dismiss it.
  if (isMobile) {
    // Android uses adjustResize, so the root already ends above the keyboard.
    // On iOS the root does not resize, so include the keyboard height.
    const effectiveBottomInset =
      Platform.OS === 'ios' && keyboardHeight > 0
        ? keyboardHeight
        : insets.bottom;
    const bottomOffset = effectiveBottomInset + containerHeight + 24;
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
            <SlashCommandPopup
              onPress={onSelectSlashCommand}
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
        <SlashCommandPopup
          onPress={onSelectSlashCommand}
          options={options}
          ref={ref}
        />
      </View>
    </YStack>
  );
}

const InputSlashCommandPopup = React.forwardRef(InputSlashCommandPopupInternal);
export default InputSlashCommandPopup;
