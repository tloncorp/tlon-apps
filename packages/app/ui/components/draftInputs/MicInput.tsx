import * as domain from '@tloncorp/shared/domain';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'tamagui';

import { DraftInputContext } from './shared';

export function MicInput({
  draftInputContext,
}: {
  draftInputContext: DraftInputContext;
}) {
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);

  useEffect(() => {
    AudioModule.getRecordingPermissionsAsync().then((res) =>
      setPermissionStatus(res.status)
    );
  }, []);

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
    if (permissionStatus !== 'granted') {
      const res = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionStatus(res.status);
      if (res.status !== 'granted') {
        return;
      }
    }
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [permissionStatus, recorder]);

  const stopRecording = useCallback(async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
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
        onPress={recorderState.isRecording ? stopRecording : startRecording}
      >
        {recorderState.isRecording ? 'Stop' : 'Record'}
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
