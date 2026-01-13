import { Post } from '@tloncorp/shared/db';
import { BlockData, convertContent } from '@tloncorp/shared/logic';
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
  isNotice?: boolean;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
  searchQuery?: string;
}

export const ContentContext = createStyledContext<ContentContextProps>();

export const useContentContext = () => useContext(ContentContext);
