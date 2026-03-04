import Clipboard from '@react-native-clipboard/clipboard';
import * as db from '@tloncorp/shared/db';
import { useToast } from '@tloncorp/ui';
import { useCallback } from 'react';

export function getExposeReferencePath(post: db.Post) {
  const [kind, host, channelName] = post.channelId.split('/');
  const postId = post.id.replaceAll('.', '');
  return `/1/chan/${kind}/${host}/${channelName}/msg/${postId}`;
}

export function useHandleExposeSuccess() {
  const showToast = useToast();
  return useCallback(
    (message: string, url?: string) => {
      if (url) {
        Clipboard.setString(url);
      }
      showToast({ message, duration: 2000 });
    },
    [showToast]
  );
}
