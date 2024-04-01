import { TextArea, XStack } from 'tamagui';

import { Attachment, Camera, ChannelGalleries } from '../../assets/icons';
import { IconButton } from '../IconButton';

export default function MessageInput() {
  return (
    <XStack
      paddingHorizontal="$m"
      paddingVertical="$s"
      gap="$l"
      alignItems="center"
    >
      <XStack gap="$l">
        <IconButton onPress={() => {}}>
          <Camera />
        </IconButton>
        <IconButton onPress={() => {}}>
          <Attachment />
        </IconButton>
        <IconButton onPress={() => {}}>
          <ChannelGalleries />
        </IconButton>
      </XStack>
      <XStack flex={1}>
        <TextArea
          flexGrow={1}
          borderRadius="$xl"
          borderWidth={0}
          fontWeight="$s"
          backgroundColor="$secondaryBackground"
          size="$m"
          height="auto"
          placeholder="Message"
          enterKeyHint="send"
          multiline={true}
        />
      </XStack>
    </XStack>
  );
}
