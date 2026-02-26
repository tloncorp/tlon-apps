export interface FilesModule {
  getMimeType(uri: string): string | null;
  getFileSize(uri: string): number | null;
  getMd5(uri: string): string | null;
  getAudioFileDurationSeconds(uri: string): Promise<number | null>;
}
