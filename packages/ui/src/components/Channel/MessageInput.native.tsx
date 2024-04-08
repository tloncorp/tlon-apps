import { RichText, useEditorBridge } from '@10play/tentap-editor';
import { editorHtml } from '@tloncorp/editor/dist/editorHtml';

import { Attachment, Camera, ChannelGalleries, Send } from '../../assets/icons';
import { XStack } from '../../core';
import { IconButton } from '../IconButton';

export default function MessageInput() {
  const editor = useEditorBridge({
    customSource: editorHtml,
    autofocus: false,
    avoidIosKeyboard: true,
  });

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
      <XStack flex={1} gap="$l" alignItems="center">
        <XStack
          borderRadius="$xl"
          height="$4xl"
          backgroundColor="$secondaryBackground"
          paddingHorizontal="$l"
          flex={1}
        >
          <RichText
            style={{
              padding: 8,
              backgroundColor: '$secondaryBackground',
              height: '100%',
            }}
            editor={editor}
          />
        </XStack>
        <IconButton onPress={() => {}}>
          {/* TODO: figure out what send button should look like */}
          <Send />
        </IconButton>
      </XStack>
    </XStack>
  );
}
