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
    const cleanup = () => {
      audio.src = '';
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 10_000);

    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeoutId);
      const duration = isFinite(audio.duration) ? audio.duration : null;
      cleanup();
      resolve(duration);
    });

    audio.addEventListener('error', () => {
      clearTimeout(timeoutId);
      cleanup();
      resolve(null);
    });

    audio.src = uri;
  });
}
