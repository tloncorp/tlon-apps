import { Post, updatePost } from '@tloncorp/shared/db';
import { BlockData, convertContent, parsePostBlob } from '@tloncorp/shared/logic';
import { useContext, useEffect, useMemo, useRef } from 'react';
import { Image } from 'react-native';
import { createStyledContext } from 'tamagui';

/**
 * Checks whether a file blob entry looks like an image or video that is
 * missing resolved dimensions, and if so resolves them and writes the
 * updated blob back to the database.
 */
function useResolveFileBlobDimensions(post: Post) {
  const resolvedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const blob = post.blob;
    if (!blob) return;

    let entries: ReturnType<typeof parsePostBlob>;
    try {
      entries = parsePostBlob(blob);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.type !== 'file') continue;
      const mime = entry.mimeType?.toLowerCase() ?? '';
      if (!mime.startsWith('image/')) continue;
      // Already resolved
      if (entry.width && entry.height) continue;
      // Already attempted this URI
      if (resolvedRef.current.has(entry.fileUri)) continue;

      resolvedRef.current.add(entry.fileUri);

      Image.getSize(
        entry.fileUri,
        (width, height) => {
          // Re-parse the blob and patch the specific entry, then write back
          try {
            const current = parsePostBlob(post.blob ?? '');
            const patched = current.map((e) =>
              e.type === 'file' && e.fileUri === entry.fileUri
                ? { ...e, width, height }
                : e
            );
            updatePost({
              id: post.id,
              blob: JSON.stringify(patched),
            });
          } catch {
            // best-effort
          }
        },
        () => {
          // Failed to get size — leave as-is
        }
      );
    }

    // For video file blobs, we can't easily resolve dimensions without
    // loading the video element. The VideoEmbed component already handles
    // unknown dimensions gracefully, so we skip write-back for video here.
  }, [post.id, post.blob]);
}

export function usePostContent(post: Post): BlockData[] {
  useResolveFileBlobDimensions(post);

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
