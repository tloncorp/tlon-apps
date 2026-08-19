import { Text } from '@tloncorp/ui';
import { styled } from 'tamagui';

/** Shared type treatments for splash panes. */

export const SplashTitle = styled(Text, {
  fontSize: '$xl',
  fontWeight: '600',
  marginHorizontal: '$xl',
});

export const SplashParagraph = styled(Text, {
  size: '$body',
  marginHorizontal: '$xl',
  marginBottom: '$2xl',
  color: '$secondaryText',
});
