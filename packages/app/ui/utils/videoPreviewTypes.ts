export type VideoPreviewSource = { uri: string } | { file: File };

export type VideoPreviewData = {
  width?: number;
  height?: number;
  duration?: number;
  posterUri?: string;
};
