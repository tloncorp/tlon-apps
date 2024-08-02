import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { AppDataContextProvider, GroupChannelsScreenView } from '@tloncorp/ui';
import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';

export function GroupChannelsScreen() {
  const { ship, name } = useParams();
  const navigate = useNavigate();
  const groupId = `${ship}/${name}`;
  // const groupParam = route.params.group;
  const groupQuery = store.useGroup({ id: groupId });
  const handleChannelSelected = useCallback(
    (channel: db.Channel) => {
      // navigation.navigate('Channel', {
      // channel: channel,
      // });
      navigate('/group/' + groupId + '/channel/' + channel.id);
    },
    [navigate, groupId]
  );
  const handleGoBackPressed = useCallback(() => {
    navigate('..');
  }, [navigate]);

  const contactsQuery = store.useContacts();

  return (
    <AppDataContextProvider contacts={contactsQuery.data ?? null}>
      <GroupChannelsScreenView
        onChannelPressed={handleChannelSelected}
        onBackPressed={handleGoBackPressed}
        group={groupQuery.data}
        channels={groupQuery.data?.channels}
      />
    </AppDataContextProvider>
  );
}
