import ChatListScreen from '@tloncorp/app/features/top/ChatListScreen';
import { isDmChannelId } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

// import AddGroupSheet from '../components/AddGroupSheet';

export function ChatListScreenController() {
  const navigate = useNavigate();
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [startDmOpen, setStartDmOpen] = useState(false);

  const handleAddGroupOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setAddGroupOpen(false);
    }
  }, []);

  const goToChannel = useCallback(
    ({ channel }: { channel: db.Channel }) => {
      setStartDmOpen(false);
      setAddGroupOpen(false);
      setTimeout(
        () => navigate(`/group/${channel.groupId}/channel/${channel.id}`),
        150
      );
    },
    [navigate]
  );

  const handleGroupCreated = useCallback(
    ({ channel }: { channel: db.Channel }) => goToChannel({ channel }),
    [goToChannel]
  );

  const handleNavigateToChannel = useCallback(
    (channel: db.Channel, postId?: string | null) => {
      if (isDmChannelId(channel.id)) {
        if (postId) {
          navigate(`/dm/${channel.id}/${postId}`);
        } else {
          navigate(`/dm/${channel.id}`);
        }
      } else {
        if (postId) {
          navigate(`/group/${channel.groupId}/channel/${channel.id}/${postId}`);
        } else {
          navigate(`/group/${channel.groupId}/channel/${channel.id}`);
        }
      }
    },
    [navigate]
  );

  return (
    <>
      <ChatListScreen
        setStartDmOpen={setStartDmOpen}
        startDmOpen={startDmOpen}
        setAddGroupOpen={setAddGroupOpen}
        navigateToDm={(channel) => {
          navigate(`/dm/${channel.id}`);
        }}
        navigateToGroupChannels={(group) => {
          navigate(`/group/${group.id}`);
        }}
        navigateToSelectedPost={handleNavigateToChannel}
        navigateToHome={() => {
          navigate('/');
        }}
        navigateToNotifications={() => {
          navigate('/activity');
        }}
        navigateToProfile={() => {
          navigate('/profile');
        }}
      />
      {/*
      <AddGroupSheet
        open={addGroupOpen}
        onOpenChange={handleAddGroupOpenChange}
        onCreatedGroup={handleGroupCreated}
      />
      */}
    </>
  );
}
