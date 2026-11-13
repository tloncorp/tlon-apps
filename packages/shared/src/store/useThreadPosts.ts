import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getDurableClient } from '@tloncorp/api/client/durable';
import { durableMessageToPost } from '@tloncorp/api/client/postsApi';

import * as db from '../db';
import { syncThreadPosts } from './sync';
import {
  ThreadViewSnapshot,
  monitorThreadCatchup,
} from './threadSyncTelemetry';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

export const useThreadPosts = ({
  postId,
  channelId,
  authorId,
  enabled = true,
}: {
  postId: string;
  authorId: string;
  channelId: string;
  enabled?: boolean;
}) => {
  const client = getDurableClient();
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const loading = useRef(false);
  useEffect(() => {
    if (client && !enabled) return;
    let mounted = true;
    setHasOlder(false);
    syncThreadPosts({
      postId,
      authorId,
      channelId,
      trigger: 'thread_open',
    })
      .then(() => {
        if (mounted)
          setHasOlder(client?.hasOlderReplies(channelId, postId) ?? false);
      })
      .catch(() => {
        // syncThreadPosts records the failure.
      });
    return () => {
      mounted = false;
    };
  }, [authorId, channelId, postId, client, enabled]);

  const loadOlder = useCallback(async () => {
    if (!client || loading.current) return;
    loading.current = true;
    setLoadingOlder(true);
    setOlderError(false);
    try {
      const messages = await client.olderReplies(channelId, postId);
      await db.insertChannelPosts({
        posts: messages.map((message) =>
          durableMessageToPost(channelId, message)
        ),
      });
      setHasOlder(client.hasOlderReplies(channelId, postId));
    } catch {
      setOlderError(true);
    } finally {
      loading.current = false;
      setLoadingOlder(false);
    }
  }, [client, channelId, postId]);

  const query = useQuery({
    queryKey: [
      ['thread', postId, authorId],
      useKeyFromQueryDeps(db.getThreadPosts),
    ],
    queryFn: () => db.getThreadPosts({ parentId: postId }),
  });
  return { ...query, hasOlder, loadingOlder, olderError, loadOlder };
};

/** Reports the committed query and list inputs without modifying either cache. */
export function useThreadCatchupTelemetry({
  postId,
  channelId,
  active,
  isForeground,
  view,
}: {
  postId: string;
  channelId: string;
  active: boolean;
  isForeground: () => boolean;
  view: ThreadViewSnapshot;
}) {
  const latest = useRef({ view, active, isForeground });
  const monitor = useRef<ReturnType<typeof monitorThreadCatchup> | null>(null);
  const previousThread = useRef<string | null>(null);
  const activationTrigger = useRef<'focus' | 'foreground'>('focus');
  useEffect(() => {
    latest.current = { view, active, isForeground };
    if (!active)
      activationTrigger.current = isForeground() ? 'focus' : 'foreground';
    monitor.current?.update();
  }, [view, active, isForeground]);
  useEffect(() => {
    if (!active) return;
    const threadKey = JSON.stringify([channelId, postId]);
    monitor.current = monitorThreadCatchup(
      { channelId, postId },
      () => db.getThreadPostDiagnostics({ parentId: postId }),
      () => latest.current.view,
      () => latest.current.active && latest.current.isForeground(),
      previousThread.current === threadKey ? activationTrigger.current : 'focus'
    );
    previousThread.current = threadKey;
    return () => {
      monitor.current?.stop();
      monitor.current = null;
    };
  }, [active, postId, channelId]);
}
