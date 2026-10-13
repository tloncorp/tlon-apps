import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

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
}: {
  postId: string;
  authorId: string;
  channelId: string;
}) => {
  useEffect(() => {
    // TODO: Check if necessary, based on unreads or reply count
    syncThreadPosts({
      postId,
      authorId,
      channelId,
      trigger: 'thread_open',
    }).catch(() => {
      // syncThreadPosts records the failure; don't leave an unhandled rejection.
    });
  }, [authorId, channelId, postId]);

  return useQuery({
    queryKey: [
      ['thread', postId, authorId],
      useKeyFromQueryDeps(db.getThreadPosts),
    ],
    queryFn: () => db.getThreadPosts({ parentId: postId }),
  });
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
