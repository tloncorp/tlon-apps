import { FilesModule } from './shared';

const module: FilesModule = {
  getMimeType() {
    return null;
  },
  getFileSize() {
    return null;
  },
  getMd5() {
    return null;
  },
  async getAudioFileDurationSeconds() {
    return null;
  },
};

export default module;
