import { Text } from '@tloncorp/ui';
import { YStack, styled, withStaticProperties } from 'tamagui';

const WidgetPaneFrame = styled(YStack, {
  backgroundColor: '$background',
  borderRadius: '$l',
  padding: '$2xl',
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
