import { ComponentType, Ref } from 'react';

export type AudioEmbed = ComponentType<{ url: string }>;
export type AudioPlayerHandle = {
  togglePlayPause: () => Promise<{ isPlaying: boolean }>;
  stop: () => void;
};
export type AudioPlayer = ComponentType<{
  url: string;
  canUnload?: boolean | undefined;
  ref?: Ref<AudioPlayerHandle>;
}>;
