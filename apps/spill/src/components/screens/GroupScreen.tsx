import {ChannelList} from '@components/ObjectList';
import * as db from '@db';
import {Stack} from '@ochre';
import React, {useMemo} from 'react';
import {NavigationScreenProps, useScreenHeight} from '../../utils/navigation';

export function GroupScreen({route}: NavigationScreenProps<'Group'>) {
  const {groupId} = route.params;

  const settings: db.TabSettings = useMemo(
    () => ({
      ...db.TabSettings.default(),
      query: {
        inGroups: [{id: groupId}] as db.Group[],
        groupBy: 'channel',
      },
    }),
    [groupId],
  );

  return (
    <Stack height={useScreenHeight()}>
      <ChannelList settings={settings} />
    </Stack>
  );
}
