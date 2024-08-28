//tamagui-ignore
import { PostType } from '@tloncorp/shared/dist/db';
import { ComponentProps, useContext } from 'react';
import {
  View,
  ViewStyle,
  XStack,
  YStack,
  createStyledContext,
  styled,
  withStaticProperties,
} from 'tamagui';

import { Icon, IconType } from '../Icon';
import { PostViewMode } from '../PostContent/ContentRenderer';
import { Text } from '../TextV2';

export type ReferenceProps = ComponentProps<typeof ReferenceComponent> & {
  actionIcon?: IconType | null;
  openOnPress?: boolean;
};

export const ReferenceContext = createStyledContext<{
  /**
   * The type of context embedding this ref
   */
  viewMode?: PostViewMode;
  /**
   * Mode for actually rendering the content
   */
  renderMode?: PostType;
  actionIcon?: IconType;
}>({
  viewMode: 'chat',
  renderMode: 'chat',
  actionIcon: 'ArrowRef',
});

export const useReferenceContext = () => {
  return useContext(ReferenceContext);
};

const ReferenceFrame = styled(YStack, {
  context: ReferenceContext,
  name: 'ReferenceFrame',
  borderRadius: '$m',
  padding: 0,
  borderColor: '$border',
  borderWidth: 1,
  backgroundColor: '$secondaryBackground',
  overflow: 'hidden',
  variants: {
    viewMode: {
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
  paddingRight: '$l',
  paddingVertical: '$s',
  justifyContent: 'space-between',
  borderBottomColor: '$border',
  borderBottomWidth: 1,
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

const ReferenceTitleText = styled(Text, {
  name: 'ReferenceTitleText',
  size: '$label/m',
  color: '$tertiaryText',
});

const ReferenceActionIcon = ({
  type,
  ...props
}: { type?: IconType } & Omit<ComponentProps<typeof Icon>, 'type'>) => {
  const { actionIcon } = useReferenceContext();
  return actionIcon ? (
    <Icon
      color="$tertiaryText"
      // Hacking a little to shrink container by a couple pixels to compensate
      // for inset border in ochre
      marginTop={-1}
      marginBottom={-1}
      customSize={[15, 15]}
      {...props}
      type={type ?? 'ArrowRef'}
    />
  ) : null;
};

const ReferenceBody = styled(View, {
  context: ReferenceContext,
  name: 'ReferenceBody',
  padding: '$l',
  gap: '$l',
  pointerEvents: 'none',
  variants: {
    renderMode: {
      note: {
        padding: '$2xl',
        gap: '$2xl',
      },
    },
  } as const,
});

export const Reference = withStaticProperties(ReferenceComponent, {
  Frame: ReferenceFrame,
  Header: ReferenceHeader,
  Title: ReferenceTitle,
  TitleIcon: ReferenceTitleIcon,
  TitleText: ReferenceTitleText,
  Body: ReferenceBody,
  ActionIcon: ReferenceActionIcon,
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
        <Text size="$body" color="$tertiaryText" flex={1}>
          {message}
        </Text>
      </XStack>
    </ReferenceBody>
  );
}
