import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import { ChannelFromTemplateView, GroupsProvider } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ChannelTemplate'>;

export function ChannelTemplateScreen(props: Props) {
  const { channelId } = props.route.params;
  const channelQuery = store.useChannel({ id: channelId });
  const { data: groups } = store.useGroups({});

  const { resetToChannel } = useRootNavigation();

  const handleGoToChannel = useCallback(
    (channel: db.Channel) => {
      resetToChannel(channel.id, { groupId: channel.groupId ?? undefined });
    },
    [resetToChannel]
  );

  return (
    <GroupsProvider groups={groups ?? []}>
      <ChannelFromTemplateView
        channel={channelQuery.data ?? undefined}
        goBack={props.navigation.goBack}
        navigateToChannel={handleGoToChannel}
      />
    </GroupsProvider>
  );
}
