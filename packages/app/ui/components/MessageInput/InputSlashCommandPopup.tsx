import React, { PropsWithRef } from 'react';
import { View, YStack } from 'tamagui';

import { type SlashCommandOption } from '../BareChatInput/useSlashCommands';
import { useIsWindowNarrow } from '../Emoji';
import SlashCommandPopup, {
  type SlashCommandPopupRef,
} from '../SlashCommandPopup';

function InputSlashCommandPopupInternal(
  {
    containerHeight,
    isSlashCommandModeActive,
    options,
    onSelectSlashCommand,
  }: PropsWithRef<{
    containerHeight: number;
    isSlashCommandModeActive: boolean;
    options: SlashCommandOption[];
    onSelectSlashCommand: (option: SlashCommandOption) => void;
  }>,
  ref: SlashCommandPopupRef
) {
  const isNarrow = useIsWindowNarrow();

  return isSlashCommandModeActive ? (
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
  ) : null;
}

const InputSlashCommandPopup = React.forwardRef(InputSlashCommandPopupInternal);
export default InputSlashCommandPopup;
