import * as domain from '@tloncorp/shared/domain';
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'tamagui';

import { DraftInputContext } from './shared';

export function MicInput({
  draftInputContext,
}: {
  draftInputContext: DraftInputContext;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);

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
    let permission = await getRecordingPermissionsAsync();
    if (permission.status !== 'granted') {
      permission = await requestRecordingPermissionsAsync();
    }
    if (permission.status !== 'granted') {
      setIsRecording(false);
      return;
    }
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    await recorder.stop();
    await setAudioModeAsync({
      allowsRecording: false,
    });
    setRecordingUri(recorder.uri);
  }, [recorder]);

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
