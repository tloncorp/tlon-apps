import { SizableText, styled, withStaticProperties } from 'tamagui';

import { YStack } from '../core';

const WidgetPaneFrame = styled(YStack, {
  backgroundColor: '$secondaryBackground',
  borderRadius: '$3xl',
  padding: '$2xl',
});

const WidgetPaneTitle = styled(SizableText, {
  color: '$tertiaryText',
  fontSize: '$l',
  marginBottom: '$m',
});

export const WidgetPane = withStaticProperties(WidgetPaneFrame, {
  Title: WidgetPaneTitle,
});
