import { Button } from '../core/Button';
import { SizableText } from '../core/Text';

export default function FloatingActionButton({
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
      shadowColor={'$primaryText'}
      shadowOpacity={0.125}
      shadowRadius={'$m'}
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

export { FloatingActionButton };
