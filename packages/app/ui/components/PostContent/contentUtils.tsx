import type { PostBlobDataEntryA2UISelection } from '@tloncorp/api';
import { Post } from '@tloncorp/shared/db';
import { type A2UI, BlockData, convertContent } from '@tloncorp/shared/logic';
import { useContext, useMemo } from 'react';
import { createStyledContext } from 'tamagui';

export function usePostContent(post: Post): BlockData[] {
  return useMemo(() => {
    try {
      return convertContent(post.content, post.blob ?? undefined);
    } catch (e) {
      console.error('Failed to convert post content:', e);
      return [];
    }
  }, [post]);
}

export function usePostLastEditContent(post: Post): BlockData[] {
  return useMemo(() => {
    try {
      return convertContent(post.lastEditContent, post.blob ?? undefined);
    } catch (e) {
      console.error('Failed to convert post content:', e);
      return [];
    }
  }, [post]);
}

export interface ContentContextProps {
  groupId?: string | null;
  isNotice?: boolean;
  onPressImage?: (src: string) => void;
  getImageViewerId?: (src: string) => string | undefined;
  onLongPress?: () => void;
  onA2UIAction?: (
    action: A2UI.Button['action'],
    selection?: PostBlobDataEntryA2UISelection
  ) => void | Promise<void>;
  isA2UIActionAvailable?: (action: A2UI.Button['action']) => boolean;
  canSendA2UIResponse?: boolean;
  searchQuery?: string;
}

export const ContentContext = createStyledContext<ContentContextProps>();

export const useContentContext = () => useContext(ContentContext);
