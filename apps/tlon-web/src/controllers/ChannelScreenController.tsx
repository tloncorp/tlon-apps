// import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ChannelScreen from '@tloncorp/app/features/top/ChannelScreen';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

// import type { RootStackParamList } from '../types';

// type ChannelScreenControllerProps = NativeStackScreenProps<
// RootStackParamList,
// 'Channel'
// >;

export function ChannelScreenController() {
  const navigate = useNavigate();
  const { ship, name, chType, chShip, chName, postId } = useParams();
  const location = useLocation();
  const isDm = location.pathname.includes('/dm/');
  const channelId = isDm && chShip ? chShip : `${chType}/${chShip}/${chName}`;
  const groupId = `${ship}/${name}`;
  const { data: channel } = store.useChannel({ id: channelId });
  const { data: group } = store.useGroup({ id: groupId });
  const handleGoToDm = useCallback(
    async (dmChannel: db.Channel) => {
      // props.navigation.push('Channel', { channel: dmChannel });
      navigate(`/dm/${dmChannel.id}`);
    },
    [navigate]
  );

  const handleGoToUserProfile = useCallback((userId: string) => {
    // props.navigation.push('UserProfile', { userId });
  }, []);

  const handleGoBack = useCallback(() => {
    navigate('..');
  }, [navigate]);

  console.log('ChannelScreenController', channel, group, postId);

  if (!channel || (!isDm && !group)) {
    return null;
  }

  return (
    <ChannelScreen
      channelFromParams={channel}
      selectedPostId={postId}
      groupFromParams={group}
      navigateToDm={handleGoToDm}
      goBack={handleGoBack}
      navigateToUserProfile={handleGoToUserProfile}
    />
  );
}
