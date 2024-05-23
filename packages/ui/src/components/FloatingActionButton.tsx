import { IconButton } from './IconButton';

export default function FloatingActionButton({
  onPress,
  icon,
}: {
  onPress: () => void;
  icon: React.ReactNode;
}) {
  return (
    <IconButton
      backgroundColor="$primaryText"
      backgroundColorOnPress="$tertiaryText"
      color="$background"
      radius="$xl"
      onPress={onPress}
    >
      {icon}
    </IconButton>
  );
}
