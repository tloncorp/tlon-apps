import { ComponentProps, PropsWithChildren } from 'react';
import { Dimensions } from 'react-native';
import { createStyledContext, styled, withStaticProperties } from 'tamagui';

import { View, XStack, YStack } from '../../core';
import { PostViewMode } from '../ContentRenderer';
import { Icon } from '../Icon';
import Pressable from '../Pressable';

export type ReferenceProps = {
  onPress: () => void;
};

export const ReferenceContext = createStyledContext<{
  asAttachment?: boolean;
  viewMode?: PostViewMode;
}>({
  asAttachment: false,
  viewMode: 'chat',
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
        width: Dimensions.get('window').width - 30,
      },
    },
    viewMode: {
      chat: {
        marginLeft: 0,
      },
      block: {
        backgroundColor: '$secondaryBackground',
      },
      note: {
        marginLeft: 0,
      },
      activity: {
        marginLeft: 0,
      },
    },
  } as const,
});

const ReferenceHeader = styled(XStack, {
  context: ReferenceContext,
  paddingHorizontal: '$l',
  paddingVertical: '$m',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottomColor: '$border',
  borderBottomWidth: 1,
  variants: {
    asAttachment: {
      true: {
        width: Dimensions.get('window').width - 30,
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
    viewMode: {
      block: {
        display: 'none',
      },
      chat: {
        display: 'flex',
      },
      note: {
        display: 'flex',
      },
    },
  } as const,
});

const ReferenceBody = styled(View, {
  paddingHorizontal: '$l',
  paddingBottom: '$m',
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
