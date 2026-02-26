import * as SpeechTranscriber from 'expo-speech-transcriber';
import { memoize } from 'lodash';
import { Platform } from 'react-native';

import { File } from './utils';

async function transcribeAudioFile(audioFileUri: string): Promise<string> {
  if (Platform.OS !== 'ios') {
    return Promise.reject(
      new Error('Audio transcription is only supported on iOS')
    );
  }
  if (SpeechTranscriber.isAnalyzerAvailable()) {
    // iOS 26+
    return await SpeechTranscriber.transcribeAudioWithAnalyzer(audioFileUri);
  } else {
    return await SpeechTranscriber.transcribeAudioWithSFRecognizer(
      audioFileUri
    );
  }
}

export async function requestTranscriptionPermissionsIfNeeded(): Promise<{
  status: 'granted' | 'not-granted' | 'unavailable';
}> {
  if (Platform.OS !== 'ios') {
    // Transcription is only supported on iOS
    return { status: 'unavailable' };
  }

  const transcriptionPermissions = await SpeechTranscriber.requestPermissions();
  return {
    status:
      transcriptionPermissions === 'authorized' ? 'granted' : 'not-granted',
  };
}

export const transcribeAudioFileWithGlobalCache = memoize(
  transcribeAudioFile,
  (uri) => File.getMd5(uri) ?? uri
);
