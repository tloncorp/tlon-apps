import { getSize, getSpace } from '@tamagui/get-token';
import { cloneElement, useContext } from 'react';
import {
  SizeTokens,
  Stack,
  Text,
  Variable,
  View,
  createStyledContext,
  styled,
  useTheme,
  withStaticProperties,
} from 'tamagui';

export const ButtonContext = createStyledContext<{
  size: SizeTokens;
  minimal: boolean;
  onPress?: () => void;
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
          // TODO: do we need to set the hight explicitly here? is text size + padding enough? Seems
          // to cause layout issues
          // height: tokens.size[name],
          // borderRadius: tokens.radius[name],

          // note the getSpace and getSize helpers will let you shift down/up token sizes
          // whereas with gap we just multiply by 0.2
          // this is a stylistic choice, and depends on your design system values
          // gap: (tokens.space[name] as Variable).val * 0.2,
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
        pressStyle: {
          backgroundColor: 'transparent',
        },
      },
    } as const,
  },
});

export const ButtonFrameImpl = ButtonFrame.styleable((props, ref) => {
  // adding group to the styled component itself seems to break typing for variants
  return <ButtonFrame group="button" {...props} ref={ref} />;
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
        '$group-button-press': {
          color: '$secondaryText',
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

export const Button = withStaticProperties(ButtonFrameImpl, {
  Props: ButtonContext.Provider,
  Text: ButtonText,
  Icon: ButtonIcon,
});
