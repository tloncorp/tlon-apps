import create from 'zustand';

import { syncQueue } from './syncQueue';

type ActiveChannelState = {
  activeChannelId: string | null;
  setActiveChannel: (channelId: string | null) => void;
  isActiveChannel: (channelId: string) => boolean;
};

export const useActiveChannel = create<ActiveChannelState>((set, get) => ({
  activeChannelId: null,
  setActiveChannel: (channelId) => {
    set({ activeChannelId: channelId });
  },
  isActiveChannel: (channelId) => get().activeChannelId === channelId,
}));
