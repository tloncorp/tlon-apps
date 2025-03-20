import { Text, triggerHaptic } from '@tloncorp/ui';
import { useCallback } from 'react';
import { View, XStack, XStackProps, YStack } from 'tamagui';

import { Icon, useCopy } from '../utils';
import { WidgetPane } from './WidgetPane';

export function CopyableTextBlock(props: { text: string } & XStackProps) {
  const { text, ...rest } = props;
  const { doCopy, didCopy } = useCopy(text);

  const handleCopy = useCallback(() => {
    doCopy();
    triggerHaptic('baseButtonClick');
  }, [doCopy]);

  return (
    <WidgetPane
      backgroundColor="$secondaryBackground"
      onPress={handleCopy}
      {...rest}
    >
      <YStack gap="$l">
        <XStack
          justifyContent="flex-end"
          alignItems="center"
          gap="$s"
          position="relative"
          bottom="$m"
          left="$m"
        >
          <Text size="$label/m" color="$secondaryText">
            Copy
          </Text>
          <Icon
            customSize={[16, 16]}
            color="$secondaryText"
            type={didCopy ? 'Checkmark' : 'Copy'}
          />
        </XStack>
        <Text size="$label/m" color="$tertiaryText">
          {props.text}
        </Text>
      </YStack>
    </WidgetPane>
  );
}
