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
      backgroundColor="$background"
      backgroundColorOnPress="$tertiaryText"
      color="$primaryText"
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
