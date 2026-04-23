import { createAudioPlayer } from 'expo-audio';
import { File } from 'expo-file-system';

// expo-file-system V2 requires an absolute URI (e.g. `file:///...`). Accept
// either a raw path or a URI and normalize to a URI.
function toFileUri(pathOrUri: string): string {
  try {
    return new URL(pathOrUri).toString();
  } catch {
    return new URL(`file://${pathOrUri}`).toString();
  }
}

export function getMimeType(uri: string): string | null {
  return new File(toFileUri(uri)).type;
}

export function getFileSize(uri: string): number | null {
  return new File(toFileUri(uri)).size;
}

export async function getAudioFileDurationSeconds(
  uri: string
): Promise<number | null> {
  const soundPlayer = createAudioPlayer(uri);

  // Even though soundPlayer.duration is accessible at this point, it is 0
  // until the player has loaded the file.
  // Wait for the load, erroring on timeout:
  let timeout: ReturnType<typeof setTimeout> | null = null;
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
