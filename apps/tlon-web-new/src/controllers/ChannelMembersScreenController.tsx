import { ChannelMembersScreen } from '@tloncorp/app/features/channels/ChannelMembersScreen';
import { useNavigate, useParams } from 'react-router';

export function ChannelMembersScreenController() {
  const { chShip: channelId } = useParams<{ chShip: string }>();
  const navigate = useNavigate();

  if (!channelId) {
    return null;
  }

  return (
    <ChannelMembersScreen channelId={channelId} onGoBack={() => navigate(-1)} />
  );
}
