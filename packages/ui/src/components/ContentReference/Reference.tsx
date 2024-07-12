import { PostType } from '@tloncorp/shared/dist/db';
import { ComponentProps, useContext } from 'react';
import { Dimensions } from 'react-native';
import {
  SizableText,
  ViewStyle,
  createStyledContext,
  styled,
  withStaticProperties,
} from 'tamagui';

import { View, XStack, YStack } from '../../core';
import { PostViewMode } from '../ContentRenderer';
import { Icon } from '../Icon';

export const REF_AUTHOR_WIDTH = 230;

export type ReferenceProps = ComponentProps<typeof ReferenceComponent>;

export const ReferenceContext = createStyledContext<{
  /**
   * The type of context embedding this ref
   */
  viewMode?: PostViewMode;
  /**
   * Mode for actually rendering the content
   */
  renderMode?: PostType;
}>({
  viewMode: 'chat',
  renderMode: 'chat',
});

export const useReferenceContext = () => {
  return useContext(ReferenceContext);
};

const ReferenceFrame = styled(YStack, {
  context: ReferenceContext,
  name: 'ReferenceFrame',
  borderRadius: '$s',
  padding: 0,
  borderColor: '$border',
  marginBottom: '$s',
  borderWidth: 1,
  backgroundColor: '$secondaryBackground',
  overflow: 'hidden',
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
    pressable: {
      true: {
        pressStyle: {
          opacity: 0.8,
        },
      },
    },
  } as {
    pressable: { true: ViewStyle };
    viewMode: { [K in PostViewMode]: ViewStyle };
    renderMode: { [K in PostType]: ViewStyle };
  },
});

const ReferenceComponent = ReferenceFrame.styleable<{
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  hasData?: boolean;
}>(
  ({ children, isLoading, isError, hasData, errorMessage, ...props }, ref) => {
    return (
      <ReferenceFrame {...props} pressable={!!props.onPress} ref={ref}>
        {children}
        {isLoading ? (
          <ReferenceSkeleton
            messageType="loading"
            message="Loading remote content..."
            {...props}
          />
        ) : isError ? (
          <ReferenceSkeleton
            message={errorMessage || 'Error loading content'}
            messageType="error"
            {...props}
          />
        ) : !hasData ? (
          <ReferenceSkeleton
            messageType="not-found"
            message="This content could not be found"
            {...props}
          />
        ) : null}
      </ReferenceFrame>
    );
  },
  {
    staticConfig: {
      componentName: 'Reference',
    },
  }
);

const ReferenceHeader = styled(XStack, {
  context: ReferenceContext,
  name: 'ReferenceHeader',
  paddingLeft: '$l',
  paddingRight: '$s',
  paddingVertical: '$2xs',
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
  name: 'ReferenceTitle',
  gap: '$s',
  alignItems: 'center',
});

const ReferenceTitleIcon = styled(
  Icon,
  {
    name: 'ReferenceTitleIcon',
    color: '$tertiaryText',
    size: '$s',
  },
  {
    accept: {
      color: 'color',
    },
  }
);

const ReferenceTitleText = styled(SizableText, {
  name: 'ReferenceTitleText',
  size: '$s',
  color: '$tertiaryText',
});

const ReferenceLinkIcon = styled(
  Icon,
  {
    name: `ReferenceLinkIcon`,
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
  },
  {
    accept: {
      color: 'color',
    },
  }
);

const ReferenceBody = styled(View, {
  context: ReferenceContext,
  name: 'ReferenceBody',
  paddingHorizontal: '$l',
  paddingVertical: '$l',
  gap: '$m',
  pointerEvents: 'none',
  variants: {
    renderMode: {
      note: {
        padding: '$2xl',
        gap: '$xl',
      },
    },
  } as const,
});

export const Reference = withStaticProperties(ReferenceComponent, {
  Header: ReferenceHeader,
  Title: ReferenceTitle,
  TitleIcon: ReferenceTitleIcon,
  TitleText: ReferenceTitleText,
  Body: ReferenceBody,
  LinkIcon: ReferenceLinkIcon,
});

export function ReferenceSkeleton({
  message = 'Loading',
  messageType = 'loading',
}: {
  message?: string;
  messageType?: 'loading' | 'error' | 'not-found';
} & ComponentProps<typeof YStack>) {
  return (
    <ReferenceBody>
      <XStack gap="$s" alignItems="center">
        {messageType === 'error' ? (
          // TODO: Replace with proper error icon when available
          <Icon type="Placeholder" color="$tertiaryText" size="$s" />
        ) : null}
        <SizableText fontSize="$s" color="$tertiaryText" flex={1}>
          {message}
        </SizableText>
      </XStack>
    </ReferenceBody>
  );
}
