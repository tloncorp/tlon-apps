import * as SpeechTranscriber from 'expo-speech-transcriber';
import { memoize } from 'lodash';

import { File } from './utils';

async function transcribeAudioFile(audioFileUri: string): Promise<string> {
  return await SpeechTranscriber.transcribeAudioWithSFRecognizer(audioFileUri);
}

export async function requestTranscriptionPermissionsIfNeeded(): Promise<{
  authorized: boolean;
}> {
  const transcriptionPermissions = await SpeechTranscriber.requestPermissions();
  return { authorized: transcriptionPermissions === 'authorized' };
}

export const transcribeAudioFileWithGlobalCache = memoize(
  transcribeAudioFile,
  (uri) => File.getMd5(uri) ?? uri
);
