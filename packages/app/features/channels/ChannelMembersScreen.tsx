import * as store from '@tloncorp/shared/dist/store';
import { AppDataContextProvider, ChannelMembersScreenView } from '@tloncorp/ui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';

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

  const currentUserId = useCurrentUserId();
  const contactsQuery = store.useContacts();

  return (
    <AppDataContextProvider
      contacts={contactsQuery.data ?? null}
      currentUserId={currentUserId}
    >
      <ChannelMembersScreenView
        channel={channelQuery.data ?? undefined}
        goBack={onGoBack}
      />
    </AppDataContextProvider>
  );
}
