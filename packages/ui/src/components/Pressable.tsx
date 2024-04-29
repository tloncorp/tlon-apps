import { TouchableOpacity as RNTouchableOpacity } from 'react-native';

export default function Pressable({
  children,
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentProps<typeof RNTouchableOpacity>) {
  return <RNTouchableOpacity {...props}>{children}</RNTouchableOpacity>;
}
