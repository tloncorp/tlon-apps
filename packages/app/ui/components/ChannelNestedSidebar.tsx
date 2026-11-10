import { DESKTOP_SIDEBAR_WIDTH } from '@tloncorp/ui';
import { YStack, styled } from 'tamagui';

// The column a channel with its own hierarchy (a Bucket's folders, a
// notebook's tree) draws inside its pane on desktop, so the hierarchy never
// replaces the app sidebar beside it.
export const ChannelNestedSidebar = styled(YStack, {
  width: DESKTOP_SIDEBAR_WIDTH,
  height: '100%',
  backgroundColor: '$background',
  borderRightColor: '$border',
  borderRightWidth: 1,
});
