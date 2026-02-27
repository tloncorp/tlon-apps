import { FilesModule } from './shared';

const module: FilesModule = {
  getMimeType() {
    return null;
  },
  getFileSize() {
    return null;
  },
  async getAudioFileDurationSeconds() {
    return null;
  },
};

export default module;
