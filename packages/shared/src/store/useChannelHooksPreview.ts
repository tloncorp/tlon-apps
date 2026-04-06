import { useQuery } from '@tanstack/react-query';
import { getChannelHooksPreview } from '@tloncorp/api';
import * as ub from '@tloncorp/api/urbit';

export function useChannelHooksPreview(channelId: string) {
  return useQuery<ub.ChannelHooksPreview>({
    queryKey: ['channelHooksPreview', channelId],
    queryFn: () => getChannelHooksPreview(channelId),
    enabled: ub.idIsNest(channelId),
    staleTime: 30_000,
  });
}
