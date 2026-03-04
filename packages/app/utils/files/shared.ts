export interface FilesModule {
  getMimeType(uri: string): string | null;
  getFileSize(uri: string): number | null;
  getAudioFileDurationSeconds(uri: string): Promise<number | null>;
}
