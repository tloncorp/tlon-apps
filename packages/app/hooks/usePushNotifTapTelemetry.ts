import * as db from '@tloncorp/shared/db';
import { useEffect, useMemo } from 'react';

import {
  reportPushNotifChannelRendered,
  reportPushNotifChannelUnfocused,
} from '../lib/pushNotifTapTelemetry';

export function usePushNotifTapTelemetry({
  channelId,
  posts,
  isFocused,
  cursorPostId,
  channelMode,
}: {
  channelId: string;
  posts: db.Post[] | null | undefined;
  isFocused: boolean;
  cursorPostId?: string | null;
  channelMode?: string | null;
}) {
  const renderedPostIds = useMemo(
    () => (posts ? posts.map((post) => post.id) : []),
    [posts]
  );

  const renderContext = useMemo(() => {
    if (!posts || posts.length === 0) {
      return null;
    }
    // posts are ordered newest-first
    const newestSequenceNum = posts[0]?.sequenceNum ?? null;
    const oldestSequenceNum = posts[posts.length - 1]?.sequenceNum ?? null;

    let cursorSequenceNum: number | null = null;
    if (cursorPostId) {
      const cursorPost = posts.find((p) => p.id === cursorPostId);
      if (cursorPost) {
        cursorSequenceNum = cursorPost.sequenceNum ?? null;
      }
    }

    return {
      newestSequenceNum,
      oldestSequenceNum,
      cursorSequenceNum,
      channelMode: channelMode ?? null,
    };
  }, [posts, cursorPostId, channelMode]);

  useEffect(() => {
    if (!isFocused || !channelId || renderedPostIds.length === 0) {
      return;
    }
    reportPushNotifChannelRendered(
      channelId,
      renderedPostIds,
      renderContext ?? undefined
    );
  }, [channelId, isFocused, renderedPostIds, renderContext]);

  // When the channel loses focus, emit a fail if measurement is still active
  useEffect(() => {
    if (!isFocused && channelId) {
      reportPushNotifChannelUnfocused(channelId);
    }
  }, [isFocused, channelId]);
}
