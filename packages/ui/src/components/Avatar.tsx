import { Image, View, ViewProps } from "tamagui";
import { UrbitSigil } from "./UrbitSigil";
import type { ClientTypes as Client } from "../../../shared";

export function Avatar({
  contact,
  ...props
}: {
  contact: Client.Contact;
} & ViewProps) {
  // Note, the web Avatar component additionally checks calm settings and confirms the link is valid.
  if (contact?.avatarImage) {
    return (
      <View
        height={20}
        width={20}
        borderRadius="$2xs"
        overflow="hidden"
        {...props}
      >
        <Image
          source={{ uri: contact.avatarImage, width: 200, height: 200 }}
          height="100%"
          width="100%"
        />
      </View>
    );
  }

  return <UrbitSigil ship={contact?.id} {...props} />;
}
