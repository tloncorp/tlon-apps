import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser';
import * as store from '@tloncorp/shared/dist/store';
import { AppDataContextProvider, ChannelMembersScreenView } from '@tloncorp/ui';

import { RootStackParamList } from '../types';

type ChannelMembersScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ChannelMembers'
>;

export function ChannelMembersScreen(props: ChannelMembersScreenProps) {
  const { channelId } = props.route.params;
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
        goBack={props.navigation.goBack}
      />
    </AppDataContextProvider>
  );
}
