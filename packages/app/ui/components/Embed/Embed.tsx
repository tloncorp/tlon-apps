import { Icon, Text } from '@tloncorp/ui';
import { Image } from 'expo-image';
import { ComponentProps } from 'react';
import { XStack, YStack, styled, withStaticProperties } from 'tamagui';

const EmbedFrame = styled(YStack, {
  name: 'EmbedFrame',
  borderRadius: '$s',
  padding: 0,
  borderColor: '$border',
  borderWidth: 1,
  justifyContent: 'center',
  backgroundColor: '$secondaryBackground',
});

const EmbedHeader = styled(XStack, {
  name: 'EmbedHeader',
  gap: '$s',
  alignItems: 'center',
  paddingLeft: '$l',
  paddingRight: '$l',
  paddingVertical: '$s',
  justifyContent: 'space-between',
  borderBottomColor: '$border',
  borderBottomWidth: 1,
});

const EmbedPreview = styled(YStack, {
  name: 'EmbedPreview',
  gap: '$s',
  padding: '$l',
  width: '100%',
});

const EmbedTitle = styled(Text, {
  name: 'EmbedTitle',
  fontSize: '$s',
  color: '$tertiaryText',
});

const EmbedPopOutIcon = styled(Icon, {
  name: 'EmbedPopOutIcon',
  color: '$tertiaryText',
  size: '$s',
}).styleable(() => {
  return <Icon type="ArrowRef" color="$tertiaryText" size="$s" />;
});

const EmbedComponent = EmbedFrame.styleable<ComponentProps<typeof EmbedFrame>>(
  ({ children, ...props }, ref) => {
    return (
      <EmbedFrame {...props} ref={ref}>
        {children}
      </EmbedFrame>
    );
  },
  {
    staticConfig: {
      componentName: 'Embed',
    },
  }
);

const EmbedThumbnail = styled(Image, {
  name: 'EmbedThumbnail',
  width: '$xl',
  height: '$xl',
  borderRadius: '$s',
  overflow: 'hidden',
  backgroundColor: '$tertiaryBackground',
});

export const Embed = withStaticProperties(EmbedComponent, {
  Header: EmbedHeader,
  Preview: EmbedPreview,
  Title: EmbedTitle,
  PopOutIcon: EmbedPopOutIcon,
  Thumbnail: EmbedThumbnail,
});
