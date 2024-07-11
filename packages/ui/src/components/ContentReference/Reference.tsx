import { ComponentProps, useContext } from 'react';
import { Dimensions } from 'react-native';
import {
  ViewStyle,
  createStyledContext,
  styled,
  withStaticProperties,
} from 'tamagui';

import { Text, View, XStack, YStack } from '../../core';
import { PostViewMode } from '../ContentRenderer';
import { Icon } from '../Icon';
import { LoadingSpinner } from '../LoadingSpinner';
import Pressable from '../Pressable';

export const REF_AUTHOR_WIDTH = 230;

export type ReferenceProps = {
  onPress?: () => void;
};

export const ReferenceContext = createStyledContext<{
  viewMode?: PostViewMode;
}>({
  viewMode: 'chat',
});

export const useReferenceContext = () => {
  return useContext(ReferenceContext);
};

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
    viewMode: {
      attachment: {
        width: Dimensions.get('window').width - 30,
      },
      block: {
        backgroundColor: '$secondaryBackground',
        borderWidth: 0,
        borderRadius: 0,
        marginBottom: 0,
      },
    },
  } as { viewMode: { [K in PostViewMode]: ViewStyle } },
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
    viewMode: {
      attachment: {
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
    viewMode: {
      attachment: {
        display: 'none',
      },
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

const ReferenceFrameComponent = ReferenceFrame.styleable(
  ({ children, onPress, ...props }, ref) => (
    <Pressable onPress={onPress ?? undefined}>
      <ReferenceFrame {...props} ref={ref}>
        {children}
      </ReferenceFrame>
    </Pressable>
  )
);

export const Reference = withStaticProperties(ReferenceFrameComponent, {
  Header: ReferenceHeader,
  Title: ReferenceTitle,
  Body: ReferenceBody,
  Icon: ReferenceIcon,
});

export function ReferenceSkeleton({
  message = 'Loading',
  messageType = 'loading',
  ...props
}: {
  message?: string;
  messageType?: 'loading' | 'error' | 'not-found';
} & ComponentProps<typeof YStack>) {
  return (
    <YStack
      borderRadius="$s"
      padding="$s"
      borderColor="$border"
      borderWidth={1}
      {...props}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <XStack padding="$m" gap="$m" alignItems="center">
          {messageType === 'loading' ? (
            <LoadingSpinner />
          ) : (
            // TODO: Replace with proper error icon when available
            <Icon type="Placeholder" color="$tertiaryText" size="$l" />
          )}
          <Text fontSize="$s" color="$tertiaryText" flex={1}>
            {message}
          </Text>
        </XStack>
      </XStack>
    </YStack>
  );
}
