import { useChatState } from './chat';

const createClub = async (newClubId: string, ships: string[]) => {
  await useChatState.getState().createMultiDm(newClubId, ships);
};

export default createClub;
