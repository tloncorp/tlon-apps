import { getSize } from '@tamagui/get-token';
import { cloneElement, useContext } from 'react';
import {
  SizeTokens,
  Stack,
  Text,
  createStyledContext,
  styled,
  useTheme,
  withStaticProperties,
} from 'tamagui';

export const InputContext = createStyledContext<{ size: SizeTokens }>({
  size: '$m',
});

export const InputFrame = styled(Stack, {
  name: 'Input',
  context: InputContext,
  backgroundColor: '$background',
  alignItems: 'center',
  flexDirection: 'row',
  borderColor: '$border',
  borderWidth: 1,
  borderRadius: '$m',
  paddingVertical: '$s',
  paddingHorizontal: '$l',
});

export const ButtonText = styled(Text, {
  name: 'ButtonText',
  context: InputContext,
  color: '$primaryText',
  userSelect: 'none',

  variants: {
    size: {
      '...fontSize': (name) => ({
        fontSize: name,
      }),
    },
  } as const,
});

const ButtonIcon = (props: { children: any }) => {
  const { size } = useContext(InputContext.context);
  const smaller = getSize(size, {
    shift: -2,
  });
  const theme = useTheme();
  return cloneElement(props.children, {
    size: smaller.val * 0.5,
    color: theme.primaryText.get(),
  });
};

export const Button = withStaticProperties(InputFrame, {
  Props: InputContext.Provider,
  Text: ButtonText,
  Icon: ButtonIcon,
});
