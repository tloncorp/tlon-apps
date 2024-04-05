import { getSpace } from '@tamagui/get-token';
import {
  FontSizeTokens,
  SizeTokens,
  XGroup,
  XStack,
  createStyledContext,
  getFontSize,
  styled,
  withStaticProperties,
} from 'tamagui';

import { Input as CInput, View } from '../core';

type InputSize = '$s' | '$m' | '$l';

export const InputContext = createStyledContext<{ size: InputSize }>({
  size: '$m',
});

const InputContainerFrame = styled(XStack, {
  context: InputContext,
  justifyContent: 'space-between',
  borderWidth: 1,
  borderColor: '$border',
  borderRadius: '$m',

  variants: {
    size: {
      '...size': (val, { tokens }) => ({
        padding: getSpace(val, {
          shift: -3,
        }),
      }),
    },
    search: {
      true: {
        backgroundColor: '$color.gray100',
        borderRadius: '$m',
        // TODO: need tint & animation on press for native search feel
      },
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
  color: '$primaryText',

  // borderWidth: 1,
});

const InputImpl = InputFrame.styleable((props, ref) => {
  const { size } = InputContext.useStyledContext();
  return (
    <View flex={1}>
      <InputFrame flex={1} height="100%" ref={ref} size={size} {...props} />
    </View>
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
          paddingHorizontal: getSpace(val, { shift: -2 }),
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
  Icon: InputIconFrame,
});
