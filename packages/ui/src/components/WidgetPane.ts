import {
  SizableText,
  createStyledContext,
  styled,
  withStaticProperties,
} from 'tamagui';

import { YStack } from '../core';

const WidgetPaneContext = createStyledContext({
  altColors: false,
});

const WidgetPaneFrame = styled(YStack, {
  context: WidgetPaneContext,
  backgroundColor: '$secondaryBackground',
  borderRadius: '$3xl',
  padding: '$2xl',

  variants: {
    altColors: {
      true: {
        backgroundColor: '$secondaryBackground',
      },
    },
  } as const,
});

const WidgetPaneTitle = styled(SizableText, {
  color: '$tertiaryText',
  fontSize: '$l',
  marginBottom: '$m',

  variants: {
    altColors: {
      true: {
        color: '$secondaryText',
      },
    },
  } as const,
});

export const WidgetPane = withStaticProperties(WidgetPaneFrame, {
  Title: WidgetPaneTitle,
});
