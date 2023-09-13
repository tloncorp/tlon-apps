import create from 'zustand';

interface EphemeralState {
  groupsLocation: string;
  messagesLocation: string;
  setGroupsLocation: (location: string) => void;
  setMessagesLocation: (location: string) => void;
}

export const useEphemeralState = create<EphemeralState>((set, get) => ({
  groupsLocation: '/',
  messagesLocation: '/messages',
  setGroupsLocation: (location: string) => {
    console.log('setGroupsLocation', location);
    set({ groupsLocation: location });
  },
  setMessagesLocation: (location: string) => {
    console.log('setMessagesLocation', location);
    set({ messagesLocation: location });
  },
}));

export default useEphemeralState;
