import _ from 'lodash';
import { useMemo } from 'react';
import { Helmet } from 'react-helmet';

import { canReadChannel } from '@/logic/channel';
import { whomIsMultiDm, whomIsNest } from '@/logic/utils';
import { useUnreads } from '@/state/activity';
import { useChannels } from '@/state/channel/channel';
import { useMultiDms } from '@/state/chat';
import { useGroups } from '@/state/groups';
import { useMessagesFilter } from '@/state/settings';

export default function TalkHead() {
  const messagesFilter = useMessagesFilter();
  const unreads = useUnreads();
  const channels = useChannels();
  const multiDms = useMultiDms();
  const groups = useGroups();
  const joinedChannels = Object.entries(unreads).filter(([k, v]) => {
    const chat = channels[k];
    if (!chat) {
      return false;
    }

    const group = groups[chat.perms.group];
    const channel = group?.channels[k];
    const vessel = group?.fleet[window.our];
    return channel && vessel && canReadChannel(channel, vessel, group.bloc);
  });
  const dms = Object.entries(unreads).filter(([k, v]) => {
    if (whomIsNest(k)) {
      return false;
    }

    if (whomIsMultiDm(k)) {
      const club = multiDms[k];
      return club ? club.team.concat(club.hive).includes(window.our) : true;
    }

    return true;
  }) as [string, { count: number }][]; // so the types below merge cleanly

  const unreadsCount = useMemo(() => {
    switch (messagesFilter) {
      case 'All Messages':
        return _.sumBy(Object.values(_.concat(joinedChannels, dms)), 'count');
      case 'Group Channels':
        return _.sumBy(Object.values(joinedChannels), 'count');
      case 'Direct Messages':
        return _.sumBy(Object.values(dms), 'count');
      default:
        return _.sumBy(Object.values(_.concat(joinedChannels, dms)), 'count');
    }
  }, [messagesFilter, joinedChannels, dms]);

  return (
    <Helmet defer={false}>
      {unreadsCount > 0 ? (
        <title>{`(${unreadsCount}) `}Tlon</title>
      ) : (
        <title>Tlon</title>
      )}
    </Helmet>
  );
}
