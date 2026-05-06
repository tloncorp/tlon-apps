import * as domain from '@tloncorp/shared/domain';
import { Audio } from 'expo-av';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'tamagui';

import { DraftInputContext } from './shared';

export function MicInput({
  draftInputContext,
}: {
  draftInputContext: DraftInputContext;
}) {
  // note: `isRecording && !recording` is possible - `recording` is created
  // async after user presses record
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording>();
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  const send = useCallback(async () => {
    if (recordingUri == null) {
      return;
    }
    try {
      const draft: domain.PostDataDraft = {
        channelId: draftInputContext.channel.id,
        content: [],
        attachments: [
          {
            type: 'image',
            file: {
              uri: recordingUri,
              width: 0,
              height: 0,
            },
          },
        ],
        channelType: draftInputContext.channel.type,
        replyToPostId: null,
        isEdit: false,
      };
      await draftInputContext.sendPostFromDraft(draft);
    } catch (err) {
      console.error('failed upload', err);
    }
  }, [recordingUri, draftInputContext]);

  const startRecording = useCallback(async () => {
    setIsRecording(true);
    if (permissionResponse?.status !== 'granted') {
      await requestPermission();
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.LOW_QUALITY
    );
    setRecording(recording);
  }, [permissionResponse, requestPermission]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    if (recording == null) {
      return;
    }
    setRecording(undefined);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    const uri = recording.getURI();
    setRecordingUri(uri);
  }, [recording]);

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={{ padding: 8, gap: 8 }}
    >
      <Button
        backgroundColor={'$background'}
        style={{ height: 60 }}
        onPress={isRecording ? stopRecording : startRecording}
      >
        {isRecording ? 'Stop' : 'Record'}
      </Button>
      <Button
        backgroundColor={'$secondaryBackground'}
        style={{ height: 60 }}
        disabledStyle={{ opacity: 0.5 }}
        onPress={send}
        disabled={recordingUri == null}
      >
        Send
      </Button>
    </SafeAreaView>
  );
}
