import {
  FontSizeTokens,
  SizeTokens,
  XGroup,
  XStack,
  createStyledContext,
  styled,
  withStaticProperties,
} from 'tamagui';

import { Input as CInput, View } from '../core';

export const InputContext = createStyledContext<{ size: SizeTokens }>({
  size: '$true',
});

const InputContainerFrame = styled(XStack, {
  context: InputContext,
  flex: 1,
  justifyContent: 'space-between',

  variants: {
    size: {
      '...size': (val, { tokens }) => ({
        gap: tokens.space[val].val * 0.3,
      }),
    },
  } as const,

  defaultVariants: {
    size: '$true',
  },
});

const InputFrame = styled(CInput, {
  unstyled: true,
  context: InputContext,
  fontFamily: '$body',
  fontSize: '$true',
  color: '$primaryText',
});

const InputImpl = InputFrame.styleable((props, ref) => {
  const { size } = InputContext.useStyledContext();
  return (
    <XStack flex={1}>
      <InputFrame ref={ref} size={size} {...props} />
    </XStack>
  );
});

const InputIconFrame = styled(View, {
  context: InputContext,
  justifyContent: 'center',
  alignItems: 'center',

  variants: {
    size: {
      '...size': (val, { tokens }) => {
        return {
          paddingHorizontal: tokens.space[val],
        };
      },
    },
  } as const,
});

const InputIconImpl = InputIconFrame.styleable((props, ref) => {
  const { children, ...rest } = props;
  return (
    <InputIconFrame ref={ref} {...rest}>
      {children}
    </InputIconFrame>
  );
});

export const Input = withStaticProperties(InputContainerFrame, {
  Area: InputImpl,
  Icon: InputIconImpl,
});
