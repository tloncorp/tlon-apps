import { ChatBrief } from '@/types/chat';
import { HeapBrief } from '@/types/heap';
import { DiaryBrief } from '@/types/diary';
import useIsChannelHost from './useIsChannelHost';

function useIsChannelJoined(
  flag: string,
  briefs: { [x: string]: ChatBrief | HeapBrief | DiaryBrief }
) {
  return useIsChannelHost(flag) || (flag && flag in briefs);
}

export default useIsChannelJoined;
