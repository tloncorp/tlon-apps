import { YStack, createStyledContext, styled } from 'tamagui';

import { Text } from '@tloncorp/ui';
import { BackgroundType } from './formUtils';

export const FormContext = createStyledContext<{
  backgroundType: BackgroundType;
}>({ backgroundType: 'primary' });

// Top level form

export const FormFrame = styled(YStack, {
  context: FormContext,
  padding: '$2xl',
  gap: '$2xl',
  variants: {
    backgroundType: {
      primary: {
        backgroundColor: '$background',
      },
      secondary: {
        backgroundColor: '$secondaryBackground',
      },
    },
  } as const,
});

export const FormText = styled(Text, {
  size: '$body',
  padding: '$xl',
});
