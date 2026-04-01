import { useEffect, useRef } from 'react';

import * as db from '../db';
import { createDevLogger } from '../debug';

const logger = createDevLogger('useDetectSequenceRegression', false);

/**
 * Detect when the newest sequence number in the rendered posts drops while
 * the query mode and cursor stay the same. This indicates a regression where
 * newer posts disappeared from the view.
 */
export function useDetectSequenceRegression(
  posts: db.Post[] | null,
  channelId: string,
  mode: string | undefined,
  cursorPostId: string | null | undefined
) {
  const prevRef = useRef<{
    channelId: string;
    mode: string | undefined;
    cursorPostId: string | null | undefined;
    newestSeq: number;
  } | null>(null);

  useEffect(() => {
    if (!posts || posts.length === 0) {
      return;
    }

    // find the first post from the head with a sequence number —
    // pending/sending posts at the top may not have one yet
    let newestSeq: number | null = null;
    for (let idx = 0; idx < Math.min(posts.length, 10); idx++) {
      if (posts[idx].sequenceNum) {
        newestSeq = posts[idx].sequenceNum!;
        break;
      }
    }

    if (newestSeq == null) {
      return;
    }

    const prev = prevRef.current;
    if (
      prev &&
      prev.channelId === channelId &&
      prev.mode === mode &&
      prev.cursorPostId === cursorPostId &&
      newestSeq < prev.newestSeq
    ) {
      logger.trackEvent('Chat Scroll Regressed', {
        channelId,
        previousNewestSeq: prev.newestSeq,
        currentNewestSeq: newestSeq,
      });
    }

    prevRef.current = { channelId, mode, cursorPostId, newestSeq };
  }, [posts, channelId, mode, cursorPostId]);
}
