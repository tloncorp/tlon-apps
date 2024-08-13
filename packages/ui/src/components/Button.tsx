import { getSize, getSpace } from '@tamagui/get-token';
import { cloneElement, useContext } from 'react';
import {
  ColorTokens,
  SizeTokens,
  Stack,
  Text,
  ThemeTokens,
  createStyledContext,
  styled,
  useTheme,
  withStaticProperties,
} from 'tamagui';

export const ButtonContext = createStyledContext<{
  size: SizeTokens;
  color: ThemeTokens;
  minimal: boolean;
  hero: boolean;
  heroDestructive: boolean;
  secondary: boolean;
  disabled: boolean;
  onPress?: () => void;
}>({
  size: '$m',
  color: '$primaryText',
  minimal: false,
  hero: false,
  heroDestructive: false,
  secondary: false,
  disabled: false,
});

export const ButtonFrame = styled(Stack, {
  name: 'Button',
  context: ButtonContext,
  backgroundColor: '$background',
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  pressStyle: {
    backgroundColor: '$positiveBackground',
  },
  borderColor: '$border',
  borderWidth: 1,
  borderRadius: '$l',
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
    hero: {
      true: {
        backgroundColor: '$darkBackground',
        padding: '$xl',
        borderWidth: 0,
        pressStyle: {
          backgroundColor: '$gray700',
        },
        disabledStyle: {
          backgroundColor: '$gray600',
        },
      },
    } as const,
    heroDestructive: {
      true: {
        backgroundColor: '$background',
        padding: '$xl',
        borderWidth: 1,
        pressStyle: {
          backgroundColor: '$negativeBackground',
        },
        disabledStyle: {
          backgroundColor: '$secondaryText',
        },
      },
    } as const,
    shadow: {
      true: {
        shadowColor: '$shadow',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.35,
        shadowRadius: 35,
        elevation: 4,
      },
    },
    secondary: {
      true: {
        backgroundColor: '$border',
        padding: '$xl',
        borderWidth: 0,
        pressStyle: {
          backgroundColor: '$secondaryBackground',
        },
      },
    } as const,
  },
});

export type ButtonProps = React.ComponentProps<typeof ButtonFrame>;

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
    hero: {
      true: {
        color: '$white',
        width: '100%',
        textAlign: 'center',
        fontWeight: '400',
      },
    },
    heroDestructive: {
      true: {
        color: '$negativeActionText',
        width: '100%',
        textAlign: 'center',
        fontWeight: '500',
      },
    },
    secondary: {
      true: {
        width: '100%',
        textAlign: 'center',
        fontWeight: '500',
      },
    },

    // disabled: {
    //   true: {
    //     color: '$tertiaryText',
    //   },
    // },
  } as const,
});

const ButtonIcon = (props: { color?: ColorTokens; children: any }) => {
  const { size, color, hero, heroDestructive } = useContext(
    ButtonContext.context
  );
  const smaller = getSize(size, {
    shift: -1,
  });
  return cloneElement(props.children, {
    size: smaller.val,
    color:
      props.color ??
      color ??
      (hero || heroDestructive ? '$white' : '$primaryText'),
  });
};

export const Button = withStaticProperties(ButtonFrameImpl, {
  Props: ButtonContext.Provider,
  Text: ButtonText,
  Icon: ButtonIcon,
});
