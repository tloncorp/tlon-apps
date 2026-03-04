import * as SpeechTranscriber from 'expo-speech-transcriber';
import { memoize } from 'lodash';
import { Platform } from 'react-native';

import { getMd5 } from './md5';

async function transcribeAudioFile(
  audioFileUri: string
): Promise<string | null> {
  if (Platform.OS !== 'ios') {
    return Promise.reject(
      new Error('Audio transcription is only supported on iOS')
    );
  }
  let out: string | null = null;
  try {
    // SpeechTranscriber is generally better, we want to use it if available
    if (SpeechTranscriber.isAnalyzerAvailable()) {
      // iOS 26+
      out = await SpeechTranscriber.transcribeAudioWithAnalyzer(audioFileUri);
    }
  } catch (e) {
    // this happens on simulator, but I haven't seen it happen on real devices
    console.error(
      'Error using SpeechTranscriber analyzer, falling back to SFRecognizer',
      e
    );
  }
  if (out == null) {
    out = await SpeechTranscriber.transcribeAudioWithSFRecognizer(audioFileUri);
  }
  if (out.includes('No speech detected')) {
    // seriously
    // https://github.com/DaveyEke/expo-speech-transcriber/blob/23f1d4cb6bb8861dd6215a8186dcbe77f618fcc4/ios/ExpoSpeechTranscriberModule.swift#L254
    // https://github.com/DaveyEke/expo-speech-transcriber/blob/23f1d4cb6bb8861dd6215a8186dcbe77f618fcc4/ios/ExpoSpeechTranscriberModule.swift#L302
    return null;
  }

  return out;
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
  (uri) => getMd5(uri) ?? uri
);
