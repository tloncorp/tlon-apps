import { Image, View, ViewProps, isWeb } from "tamagui";
import { UrbitSigil } from "./UrbitSigil";
import type { ClientTypes as Client } from "../../../shared";
import { useMemo } from "react";

export function Avatar({
  contact,
  ...props
}: {
  contact: Client.Contact;
} & ViewProps) {
  // on native, we have to pass height/width for the source prop, on web we want to use other attributes
  // to set those
  const nativeDims = useMemo(
    () =>
      isWeb
        ? { height: undefined, width: undefined }
        : { height: 20, width: 20 },
    [isWeb]
  );

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
          source={{
            uri: contact.avatarImage,
            height: nativeDims.height,
            width: nativeDims.width,
          }}
          height="100%"
          width="100%"
        />
      </View>
    );
  }

  return <UrbitSigil ship={contact?.id} {...props} />;
}
