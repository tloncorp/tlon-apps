import { ComponentProps, PropsWithChildren } from 'react';
import { createStyledContext, styled, withStaticProperties } from 'tamagui';

import { View, XStack, YStack } from '../../core';
import { Icon } from '../Icon';
import Pressable from '../Pressable';

export type ReferenceProps = {
  onPress: () => void;
};

export const ReferenceContext = createStyledContext<{
  asAttachment?: boolean;
}>({
  asAttachment: false,
});

const ReferenceFrame = styled(YStack, {
  context: ReferenceContext,
  gap: '$m',
  borderRadius: '$s',
  padding: 0,
  borderColor: '$border',
  marginBottom: '$s',
  borderWidth: 1,
  backgroundColor: '$background',
  variants: {
    asAttachment: {
      true: {
        borderRadius: 0,
        width: '100%',
      },
    },
  } as const,
});

const ReferenceHeader = styled(XStack, {
  context: ReferenceContext,
  padding: '$l',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottomColor: '$border',
  borderBottomWidth: 1,
  variants: {
    asAttachment: {
      true: {
        width: '100%',
      },
    },
  } as const,
});

const ReferenceTitle = styled(XStack, {
  gap: '$m',
  alignItems: 'center',
});

const ReferenceIcon = styled(Icon, {
  context: ReferenceContext,
  color: '$tertiaryText',
  size: '$m',
  variants: {
    asAttachment: {
      true: {
        display: 'none',
      },
    },
  } as const,
});

const ReferenceBody = styled(View, {
  padding: '$l',
});

const ReferenceFrameComponent = ({
  children,
  onPress,
  ...props
}: PropsWithChildren<
  ReferenceProps & ComponentProps<typeof ReferenceFrame>
>) => (
  <Pressable onPress={onPress}>
    <ReferenceFrame {...props}>{children}</ReferenceFrame>
  </Pressable>
);

export const Reference = withStaticProperties(ReferenceFrameComponent, {
  Header: ReferenceHeader,
  Title: ReferenceTitle,
  Body: ReferenceBody,
  Icon: ReferenceIcon,
});
