import { Button } from '../core/Button';
import { SizableText } from '../core/Text';

export default function FloatingActionButton({
  onPress,
  icon,
  label,
}: {
  onPress: () => void;
  inverted?: boolean;
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
