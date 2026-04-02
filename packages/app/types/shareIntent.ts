export type ShareIntentFile = {
  path: string;
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
};

export type ChannelShareIntent = {
  createdAt: number;
  text?: string | null;
  webUrl?: string | null;
  file?: ShareIntentFile | null;
};
