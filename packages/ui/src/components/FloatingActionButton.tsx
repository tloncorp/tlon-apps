import { getSize } from '@tamagui/get-token';
import { cloneElement, useContext } from 'react';
import {
  SizableText,
  SizeTokens,
  Stack,
  Text,
  createStyledContext,
  styled,
  useTheme,
  withStaticProperties,
} from 'tamagui';

export function FloatingActionButton({
  onPress,
  icon,
  label,
}: {
  onPress: () => void;
  icon?: React.ReactNode;
  label?: string;
}) {
  return (
    <Button
      paddingHorizontal="$m"
      paddingVertical="$s"
      alignItems="center"
      onPress={onPress}
    >
      {icon}
      {label && (
        <SizableText
          ellipsizeMode="tail"
          numberOfLines={1}
          fontSize={'$s'}
          maxWidth={200}
          height={'$2xl'}
        >
          {label}
        </SizableText>
      )}
    </Button>
  );
}

const ButtonContext = createStyledContext<{ size: SizeTokens }>({
  size: '$m',
});
const ButtonFrame = styled(Stack, {
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
});

const ButtonText = styled(Text, {
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
    // typescript thinks theme.primaryText could be undefined
    color: theme.primaryText?.get(),
  });
};

const Button = withStaticProperties(ButtonFrame, {
  Props: ButtonContext.Provider,
  Text: ButtonText,
  Icon: ButtonIcon,
});
