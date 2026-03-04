import * as api from '@tloncorp/api';
import type { Post } from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useMemo } from 'react';

import { getExposeReferencePath } from '../ui/utils/postUtils';

/**
 * Returns expose state for a post: whether it's currently exposed on the
 * public profile, and the absolute public URL if so.
 *
 * @param post - The post to check
 * @param eligible - Pass `false` to skip the check (e.g. for DMs/thread
 *   replies). Defaults to true. When false, always returns
 *   `{ isExposed: false, publicPostUrl: null }`.
 */
export function usePostExposeState(
  post: Post,
  eligible: boolean = true
): { isExposed: boolean; publicPostUrl: string | null } {
  const { data: exposedPostIds } = store.useExposedPostIds();
  const { data: exposedCites } = store.useExposedPostCites();

  const exposeReferencePath = useMemo(() => {
    if (!eligible) return null;
    return getExposeReferencePath(post);
  }, [eligible, post.channelId, post.id]);

  const isExposed = useMemo(() => {
    if (!exposeReferencePath) return false;
    if (exposedPostIds?.has(post.id)) return true;
    return exposedCites?.has(exposeReferencePath) ?? false;
  }, [exposeReferencePath, exposedCites, exposedPostIds, post.id]);

  const publicPostUrl = useMemo(() => {
    if (!isExposed || !exposeReferencePath) return null;
    return `${api.getCurrentShipUrl()}/expose${exposeReferencePath}`;
  }, [isExposed, exposeReferencePath]);

  return { isExposed, publicPostUrl };
}
