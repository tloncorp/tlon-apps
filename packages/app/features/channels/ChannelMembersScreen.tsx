import * as store from '@tloncorp/shared/dist/store';
import { ChannelMembersScreenView } from '@tloncorp/ui';

export function ChannelMembersScreen({
  channelId,
  onGoBack,
}: {
  channelId: string;
  onGoBack: () => void;
}) {
  const channelQuery = store.useChannelWithRelations({
    id: channelId,
  });

  return (
    <ChannelMembersScreenView
      channel={channelQuery.data ?? undefined}
      goBack={onGoBack}
    />
  );
}
