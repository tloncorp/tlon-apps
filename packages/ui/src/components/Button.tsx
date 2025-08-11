import { getSpace } from '@tamagui/get-token';
import { cloneElement, useContext } from 'react';
import {
  ColorTokens,
  SizeTokens,
  Stack,
  TextStyle,
  ThemeTokens,
  createStyledContext,
  styled,
  withStaticProperties,
} from 'tamagui';

import { Text } from './TextV2';

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
  cursor: 'pointer',
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
  gap: '$s',
  variants: {
    size: {
      '...size': (name) => {
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
        backgroundColor: '$primaryText',
        // placeholder constant -- need to resolve ochre implementation
        height: 56,
        borderWidth: 0,
        pressStyle: {
          backgroundColor: '$primaryText',
          opacity: 0.5,
        },
        disabledStyle: {
          backgroundColor: '$tertiaryText',
        },
        $gtSm: {
          height: 48,
        },
      },
    } as const,
    heroDestructive: {
      true: {
        backgroundColor: '$background',
        // placeholder constant -- need to resolve ochre implementation
        height: 56,
        padding: '$xl',
        borderWidth: 1,
        pressStyle: {
          backgroundColor: '$negativeBackground',
        },
        disabledStyle: {
          backgroundColor: '$secondaryText',
        },
        $gtSm: {
          height: 48,
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
        height: 56,
        borderColor: '$shadow',
        pressStyle: {
          backgroundColor: '$secondaryBackground',
        },
        $gtSm: {
          height: 48,
        },
      },
    } as const,
  },
});

export type ButtonProps = React.ComponentProps<typeof ButtonFrame>;

export const ButtonFrameImpl = ButtonFrame.styleable((props, ref) => {
  // adding group to the styled component itself seems to break typing for variants
  return <ButtonFrame {...props} ref={ref} />;
});

export const ButtonText = styled(Text, {
  name: 'ButtonText',
  context: ButtonContext,
  color: '$primaryText',
  userSelect: 'none',
  size: '$label/xl',

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
    hero: (isHero: boolean, { props }: { props: { disabled?: boolean } }) => {
      return isHero
        ? {
            color: props.disabled ? '$secondaryText' : '$background',
            width: '100%',
            textAlign: 'center',
            fontWeight: '400',
          }
        : {};
    },
    heroDestructive: {
      true: {
        color: '$tertiaryText',
        width: '100%',
        textAlign: 'center',
        fontWeight: '500',
      },
    },
    secondary: {
      true: {
        color: '$secondaryText',
      },
    },
    disabled: {} as Record<'true' | 'false', TextStyle>,
  } as const,
});

const ButtonIcon = (props: { color?: ColorTokens; children: any }) => {
  const context = useContext(ButtonContext.context);

  const iconColor =
    props.color ??
    (context.hero || context.heroDestructive
      ? '$background'
      : context.color ?? '$primaryText');

  return cloneElement(props.children, {
    color: iconColor,
  });
};

export const Button = withStaticProperties(ButtonFrameImpl, {
  Props: ButtonContext.Provider,
  Text: ButtonText,
  Icon: ButtonIcon,
});
