import cn from 'classnames';
import { Pressable, Text } from 'react-native';
import { useTailwind } from 'tailwind-rn';

type Props = {
  title: string;
  isSubmit?: boolean;
  onPress: () => void;
};

export const HeaderButton = ({ title, isSubmit = false, onPress }: Props) => {
  const tailwind = useTailwind();
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Text
          style={tailwind(
            cn(
              'text-lg text-tlon-black-80 dark:text-white',
              isSubmit && 'font-semibold',
              pressed && 'opacity-80'
            )
          )}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
};
