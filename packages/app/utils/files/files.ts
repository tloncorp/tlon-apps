import * as AV from 'expo-av';
import { File } from 'expo-file-system/next';

import { FilesModule } from './shared';

const module: FilesModule = {
  getMimeType(uri: string): string | null {
    return new File(uri).type;
  },
  getFileSize(uri: string): number | null {
    return new File(uri).size;
  },
  async getAudioFileDurationSeconds(uri: string): Promise<number | null> {
    const soundPlayer = new AV.Audio.Sound();
    try {
      const status = await soundPlayer.loadAsync(
        { uri },
        { shouldPlay: false }
      );
      const duration =
        status.isLoaded && status.durationMillis != null
          ? status.durationMillis / 1000
          : 0;
      return duration;
    } finally {
      await soundPlayer.unloadAsync();
    }
  },
};

export default module;
