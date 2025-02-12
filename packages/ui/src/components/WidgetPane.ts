import { YStack, styled, withStaticProperties } from 'tamagui';

import { Text } from './TextV2';

const WidgetPaneFrame = styled(YStack, {
  backgroundColor: '$background',
  borderRadius: '$l',
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
