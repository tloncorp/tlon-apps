import { ComponentType, ForwardRefExoticComponent } from 'react';

export type AudioEmbed = ComponentType<{ url: string }>;
export type AudioPlayer = ForwardRefExoticComponent<
  {
    url: string;
    canUnload?: boolean | undefined;
  } & React.RefAttributes<{
    togglePlayPause: () => Promise<{ isPlaying: boolean }>;
    stop: () => void;
  }>
>;
