import { Text } from '@tloncorp/ui';
import { ComponentProps, PropsWithChildren } from 'react';
import { View } from 'tamagui';
import { YStack, styled, withStaticProperties } from 'tamagui';

const WidgetPaneFrame = styled(YStack, {
  backgroundColor: '$background',
  borderRadius: '$2xl',
  padding: '$2xl',

  variants: {
    editor: {
      true: {
        padding: '$m',
        borderWidth: 1,
        borderColor: '$border',
      },
    },
  } as const,
});

const WidgetPaneTitle = styled(Text, {
  color: '$tertiaryText',
  size: '$label/xl',
  trimmed: false,
  marginBottom: '$m',
});

export const WidgetPane = withStaticProperties(WidgetPaneFrame, {
  Title: WidgetPaneTitle,
});
