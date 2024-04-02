import { getSize, getSpace } from '@tamagui/get-token';
import { cloneElement, useContext } from 'react';
import {
  SizeTokens,
  Stack,
  Text,
  Variable,
  createStyledContext,
  styled,
  useTheme,
  withStaticProperties,
} from 'tamagui';

export const ButtonContext = createStyledContext<{
  size: SizeTokens;
  minimal: boolean;
}>({
  size: '$m',
  minimal: false,
});

export const ButtonFrame = styled(Stack, {
  name: 'Button',
  context: ButtonContext,
  backgroundColor: '$background',
  alignItems: 'center',
  flexDirection: 'row',
  pressStyle: {
    backgroundColor: '$positiveBackground',
  },
  borderColor: '$border',
  borderWidth: 1,
  borderRadius: '$m',
  paddingVertical: '$s',
  paddingHorizontal: '$l',
  variants: {
    size: {
      '...size': (name, { tokens }) => {
        return {
          // @ts-ignore
          height: tokens.size[name],
          // borderRadius: tokens.radius[name],
          // note the getSpace and getSize helpers will let you shift down/up token sizes
          // whereas with gap we just multiply by 0.2
          // this is a stylistic choice, and depends on your design system values
          // @ts-ignore
          gap: (tokens.space[name] as Variable).val * 0.2,
          paddingHorizontal: getSpace(name, {
            shift: -1,
          }),
        };
      },
    },
    minimal: {
      true: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        paddingVertical: 0,
        paddingHorizontal: 0,
      },
    } as const,
  },

  // defaultVariants: {
  //   size: '$m',
  // },
});

export const ButtonText = styled(Text, {
  name: 'ButtonText',
  context: ButtonContext,
  color: '$primaryText',
  userSelect: 'none',

  variants: {
    size: {
      '...fontSize': (name) => ({
        fontSize: name,
      }),
    },
    minimal: {
      true: {
        pressStyle: {
          color: '$positiveActionText',
        },
      },
    },
  } as const,
});

const ButtonIcon = (props: { children: any }) => {
  const { size } = useContext(ButtonContext.context);
  const smaller = getSize(size, {
    shift: -2,
  });
  const theme = useTheme();
  return cloneElement(props.children, {
    size: smaller.val * 0.5,
    color: theme.primaryText?.get(),
  });
};

export const Button = withStaticProperties(ButtonFrame, {
  Props: ButtonContext.Provider,
  Text: ButtonText,
  Icon: ButtonIcon,
});
