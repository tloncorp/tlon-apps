import { AudioPlayer } from 'expo-audio';
import { File } from 'expo-file-system/next';

import { FilesModule } from './shared';

const module: FilesModule = {
  getMimeType(uri: string): string | null {
    return new File(uri).type;
  },
  getFileSize(uri: string): number | null {
    return new File(uri).size;
  },
  getMd5(uri: string): string | null {
    return new File(uri).md5;
  },
  async getAudioFileDurationSeconds(uri: string): Promise<number | null> {
    const soundPlayer = new AudioPlayer(uri, 0);
    try {
      return soundPlayer.duration;
    } finally {
      soundPlayer.remove();
      soundPlayer.release();
    }
  },
};

export default module;
