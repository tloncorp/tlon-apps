import { UriProps } from "react-native-svg";
import { Image } from "tamagui";

export default function RemoteSvg(props: UriProps) {
  return (
    <Image
      height={props.height}
      width={props.width}
      source={{ uri: props.uri ?? "" }}
    />
  );
}
