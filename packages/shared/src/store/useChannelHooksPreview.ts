import { useQuery } from '@tanstack/react-query';
import { getChannelHooksPreview } from '@tloncorp/api';
import * as ub from '@tloncorp/api/urbit';

export function useChannelHooksPreview(channelId: string) {
  return useQuery<ub.ChannelHooksPreview>({
    queryKey: ['channelHooksPreview', channelId],
    queryFn: () => getChannelHooksPreview(channelId),
    // Hooks are a %channels feature; third-party channels (e.g. notes) aren't
    // %channels-backed and have no hooks, so skip the preview subscription (it
    // would bad-watch-path on %channels).
    enabled: ub.idIsNest(channelId) && !ub.isThirdPartyChannel(channelId),
    staleTime: 30_000,
  });
}
