import { ChannelMetaScreen } from '@tloncorp/app/features/channels/ChannelMetaScreen';
import { useNavigate, useParams } from 'react-router';

export function ChannelMetaScreenController() {
  const { chShip: channelId } = useParams<{ chShip: string }>();
  const navigate = useNavigate();

  if (!channelId) {
    return null;
  }

  return (
    <ChannelMetaScreen channelId={channelId} onGoBack={() => navigate(-1)} />
  );
}
