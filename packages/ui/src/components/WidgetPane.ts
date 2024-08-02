import { SizableText, styled, withStaticProperties } from 'tamagui';

import { YStack } from '../core';

const WidgetPaneFrame = styled(YStack, {
  backgroundColor: '$background',
  borderRadius: '$xl',
  padding: '$l',
});

const WidgetPaneTitle = styled(SizableText, {
  color: '$tertiaryText',
});

export const WidgetPane = withStaticProperties(WidgetPaneFrame, {
  Title: WidgetPaneTitle,
});
