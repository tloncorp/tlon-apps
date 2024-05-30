import { IconButton } from './IconButton';

export default function FloatingActionButton({
  onPress,
  icon,
  inverted = false,
}: {
  onPress: () => void;
  icon: React.ReactNode;
  inverted?: boolean;
}) {
  return (
    <IconButton
      backgroundColor={inverted ? '$primaryText' : '$background'}
      backgroundColorOnPress="$tertiaryText"
      color={inverted ? '$background' : '$primaryText'}
      radius="$4xl"
      onPress={onPress}
      height="$5xl"
      width="$5xl"
      size="$5xl"
    >
      {icon}
    </IconButton>
  );
}
