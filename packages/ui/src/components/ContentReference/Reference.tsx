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
import { Text } from '../TextV2';

export type ReferenceProps = ComponentProps<typeof ReferenceComponent> & {
  actionIcon?: IconType | null;
  contentSize?: '$s' | '$l';
  openOnPress?: boolean;
};

export const ReferenceContext = createStyledContext<{
  /**
   * The type of context embedding this ref
   */
  contentSize: '$s' | '$l';
  /**
   * Mode for actually rendering the content
   */
  actionIcon?: IconType;
}>({
  actionIcon: 'ArrowRef',
  contentSize: '$l',
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
  borderWidth: 1,
  backgroundColor: '$secondaryBackground',
  overflow: 'hidden',
  flex: 1,
  variants: {
    pressable: {
      true: {
        pressStyle: {
          opacity: 0.8,
        },
      },
    },
  } as {
    pressable: { true: ViewStyle };
    contentSize: Record<'$s' | '$m' | '$l', ViewStyle>;
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
  context: ReferenceContext,
  size: '$label/m',
  color: '$tertiaryText',
  variants: {
    contentSize: {
      $s: {
        size: '$label/s',
      },
    },
  },
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
  pointerEvents: 'none',
  flex: 1,
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
  ...props
}: {
  message?: string;
  messageType?: 'loading' | 'error' | 'not-found';
} & ComponentProps<typeof ReferenceFrame>) {
  return (
    <ReferenceFrame {...props}>
      <ReferenceBody padding="$l" justifyContent="center" alignItems="center">
        <YStack gap="$l" alignItems="center">
          {messageType === 'error' ? (
            <Icon
              type="Placeholder"
              color="$tertiaryText"
              customSize={[24, 17]}
            />
          ) : null}
          <Text
            size={props.contentSize === '$s' ? '$label/s' : '$label/m'}
            color="$tertiaryText"
            flex={1}
          >
            {message}
          </Text>
        </YStack>
      </ReferenceBody>
    </ReferenceFrame>
  );
}
