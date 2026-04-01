import { createAudioPlayer } from 'expo-audio';
import { File } from 'expo-file-system/next';

export function getMimeType(uri: string): string | null {
  return new File(uri).type;
}

export function getFileSize(uri: string): number | null {
  return new File(uri).size;
}

export async function getAudioFileDurationSeconds(
  uri: string
): Promise<number | null> {
  const soundPlayer = createAudioPlayer(uri);

  // Even though soundPlayer.duration is accessible at this point, it is 0
  // until the player has loaded the file.
  // Wait for the load, erroring on timeout:
  let timeout: NodeJS.Timeout | null = null;
  return new Promise<number | null>((resolve, reject) => {
    soundPlayer.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded) {
        resolve(status.duration);
      }
    });
    timeout = setTimeout(() => {
      reject(new Error('Timed out while loading audio file'));
    }, 10000);
  }).finally(() => {
    // manually calling `createAudioPlayer` means we have to manually dispose
    soundPlayer.release();
    timeout && clearTimeout(timeout);
  });
}
