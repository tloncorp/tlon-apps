import * as db from '@tloncorp/shared/db';
import { useEffect, useMemo } from 'react';

import { reportPushNotifChannelRendered } from '../lib/pushNotifTapTelemetry';

export function usePushNotifTapTelemetry({
  channelId,
  posts,
  isFocused,
}: {
  channelId: string;
  posts: db.Post[] | null | undefined;
  isFocused: boolean;
}) {
  const renderedPostIds = useMemo(
    () => (posts ? posts.map((post) => post.id) : []),
    [posts]
  );

  useEffect(() => {
    if (!isFocused || !channelId || renderedPostIds.length === 0) {
      return;
    }
    reportPushNotifChannelRendered(channelId, renderedPostIds);
  }, [channelId, isFocused, renderedPostIds]);
}
