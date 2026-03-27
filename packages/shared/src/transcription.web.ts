import { memoize } from 'lodash';

export async function requestTranscriptionPermissionsIfNeeded(): Promise<{
  status: 'granted' | 'not-granted' | 'unavailable';
}> {
  return { status: 'unavailable' };
}

async function transcribeAudioFile(): Promise<string | null> {
  return null;
}

export const transcribeAudioFileWithGlobalCache = memoize(transcribeAudioFile);

export async function setupTranscriptionIfNeeded(): Promise<
  | { canTranscribe: false; status: 'failed-permissions' }
  | {
      canTranscribe: false;
      status: 'missing-locale';
    }
  | { canTranscribe: true; status: 'ready' }
> {
  return { canTranscribe: false, status: 'failed-permissions' };
}
