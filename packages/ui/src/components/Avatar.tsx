import { Image, View, ViewProps } from "tamagui";
import { UrbitSigil } from "./UrbitSigil";

export function Avatar({
  id,
  avatarImage,
  ...props
}: {
  id: string;
  avatarImage?: string;
} & ViewProps) {
  // Note, the web Avatar component additionally checks calm settings and confirms the link is valid.
  if (avatarImage) {
    return (
      <View
        height={20}
        width={20}
        borderRadius="$2xs"
        overflow="hidden"
        {...props}
      >
        <Image
          source={{ uri: avatarImage, width: 200, height: 200 }}
          height="100%"
          width="100%"
        />
      </View>
    );
  }

  return <UrbitSigil ship={id} {...props} />;
}
