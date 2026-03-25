export function getMimeType(_uri: string): string | null {
  return null;
}

export function getFileSize(_uri: string): number | null {
  return null;
}

export async function getAudioFileDurationSeconds(
  uri: string
): Promise<number | null> {
  return new Promise<number | null>((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';

    audio.addEventListener('loadedmetadata', () => {
      const duration = isFinite(audio.duration) ? audio.duration : null;
      resolve(duration);
    });

    audio.addEventListener('error', () => {
      resolve(null);
    });

    audio.src = uri;
  });
}
