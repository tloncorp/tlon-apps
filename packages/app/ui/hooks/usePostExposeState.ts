import * as api from '@tloncorp/shared/api';
import type { Post } from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useMemo } from 'react';

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
  const { data: exposedCites } = store.useExposedPostCites();

  const exposeReferencePath = useMemo(() => {
    if (!eligible) return null;
    const [kind, host, channelName] = post.channelId.split('/');
    const postId = post.id.replaceAll('.', '');
    return `/1/chan/${kind}/${host}/${channelName}/msg/${postId}`;
  }, [eligible, post.channelId, post.id]);

  const isExposed = useMemo(() => {
    if (!exposeReferencePath || !exposedCites) return false;
    return exposedCites.has(exposeReferencePath);
  }, [exposeReferencePath, exposedCites]);

  const publicPostUrl = useMemo(() => {
    if (!isExposed || !exposeReferencePath) return null;
    return `${api.getCurrentShipUrl()}/expose${exposeReferencePath}`;
  }, [isExposed, exposeReferencePath]);

  return { isExposed, publicPostUrl };
}
