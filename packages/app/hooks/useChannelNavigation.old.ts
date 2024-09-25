import { isGroupChannelId } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const useChannelNavigation = ({ channelId }: { channelId: string }) => {
  // Model context
  const channelQuery = store.useChannelWithRelations({
    id: channelId,
  });

  const navigate = useNavigate();

  const navigateToPost = useCallback(
    (post: db.Post) => {
      isGroupChannelId(post.channelId)
        ? navigate(
            '/group/' +
              post.groupId +
              '/channel/' +
              post.channelId +
              '/post/' +
              post.authorId +
              '/' +
              post.id
          )
        : navigate(
            '/dm/' + post.channelId + '/post/' + post.authorId + '/' + post.id
          );
    },
    [navigate]
  );

  const navigateToRef = useCallback(
    (channel: db.Channel, post: db.Post) => {
      if (channel.id === channelId) {
        navigate(
          '/group/' + channel.groupId + '/channel/' + channel.id + '/' + post.id
        );
      } else {
        navigate(
          '/group/' + channel.groupId + '/channel/' + channel.id + '/' + post.id
        );
      }
    },
    [navigate, channelId]
  );

  const navigateToImage = useCallback(
    (post: db.Post, uri?: string) => {
      navigate(`/image/${post.id}/${encodeURIComponent(uri ?? '')}`);
    },
    [navigate]
  );

  const navigateToSearch = useCallback(() => {
    if (!channelQuery.data) {
      return;
    }
    if (isGroupChannelId(channelQuery.data.id)) {
      navigate(
        `/group/${channelQuery.data.groupId}/channel/${channelQuery.data.id}/search`
      );
      return;
    }
    navigate(`/dm/${channelQuery.data.id}/search`);
  }, [navigate, channelQuery.data]);

  return {
    navigateToPost,
    navigateToRef,
    navigateToImage,
    navigateToSearch,
  };
};
