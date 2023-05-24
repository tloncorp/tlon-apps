import { create } from 'zustand';
import useStore from './store';
import type { Club } from '../types/chat';

export interface ChatState {
  clubs: Record<string, Club>;
  fetchClub: (id: string) => Promise<Club>;
}

const useChatState = create<ChatState>((set, get) => ({
  clubs: {},
  fetchClub: async (id: string) => {
    let club = get().clubs[id];
    if (club) {
      return club;
    }

    const { api } = useStore.getState();
    if (!api) {
      throw new Error('No api found');
    }

    club = await api.scry<Club>({
      app: 'chat',
      path: `/club/${id}/crew`,
    });

    set((state) => ({ ...state, clubs: { ...state.clubs, [id]: club } }));

    return club;
  },
}));

export default useChatState;
