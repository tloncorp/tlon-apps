import * as store from '@tloncorp/shared/dist/store';
import { useLocation, useParams } from 'react-router';

const useChannelMeta = () => {
  const { ship, name, chType, chShip, chName, postId } = useParams();
  const location = useLocation();
  const isDm = location.pathname.includes('/dm/');
  const channelId = isDm && chShip ? chShip : `${chType}/${chShip}/${chName}`;
  const groupId = `${ship}/${name}`;

  const { data: channel } = store.useChannel({ id: channelId });
  const { data: group } = store.useGroup({ id: groupId });

  return { channel, group, postId, isDm, channelId, groupId };
};

export default useChannelMeta;
