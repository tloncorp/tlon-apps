import * as logic from '@tloncorp/shared/logic';
import { useCopy, useToast } from '@tloncorp/ui';
import { useCallback } from 'react';

export function useCopyChannelLink(channelId: string) {
  const { doCopy } = useCopy(logic.getChannelReferencePath(channelId));
  const toast = useToast();
  return useCallback(async () => {
    let copied = false;
    try {
      copied = await doCopy();
    } catch {
      // Reported below, the same as a write the platform refused.
    }
    toast({
      message: copied ? 'Copied!' : "Couldn't copy link",
      duration: 1500,
    });
  }, [doCopy, toast]);
}
