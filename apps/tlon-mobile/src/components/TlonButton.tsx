import cn from 'classnames';
import type { PressableProps } from 'react-native';
import { Pressable, Text } from 'react-native';
import { useTailwind } from 'tailwind-rn';

type Props = PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'minimal';
  align?: 'left' | 'center' | 'right';
  roundedFull?: boolean;
};

export const TlonButton = ({
  title,
  variant = 'primary',
  align = 'left',
  roundedFull = false,
  ...pressableProps
}: Props) => {
  const tailwind = useTailwind();
  return (
    <Pressable
      {...pressableProps}
      style={({ pressed }) => [
        tailwind(
          cn(
            'py-4 px-6',
            variant === 'primary' && 'bg-tlon-black-80',
            variant === 'secondary' &&
              'border border-tlon-black-10 dark:border-tlon-black-80',
            variant === 'minimal' &&
              pressed &&
              'bg-tlon-black-10 dark:bg-tlon-black-90',
            roundedFull ? 'rounded-full' : 'rounded-xl',
            pressed ? 'opacity-90' : 'opacity-100'
          )
        ),
      ]}
    >
      <Text
        style={tailwind(
          cn(
            'text-lg font-medium',
            variant === 'primary' && 'text-white',
            variant === 'secondary' && 'text-black dark:text-white',
            variant === 'minimal' && 'text-tlon-black-60',
            align === 'left' && 'text-left',
            align === 'center' && 'text-center',
            align === 'right' && 'text-right'
          )
        )}
      >
        {title}
      </Text>
    </Pressable>
  );
};
