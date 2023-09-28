import { useMemo } from 'react';
import _ from 'lodash';
import { Helmet } from 'react-helmet';
import { useMessagesFilter } from '@/state/settings';
import { useBriefs, useChannels } from '@/state/channel/channel';
import { useDmBriefs, useMultiDms } from '@/state/chat';
import { useGroups } from '@/state/groups';
import { canReadChannel } from '@/logic/channel';

export default function TalkHead() {
  const messagesFilter = useMessagesFilter();
  const briefs = useBriefs();
  const { data: dmBriefs } = useDmBriefs();
  const channels = useChannels();
  const multiDms = useMultiDms();
  const groups = useGroups();
  const joinedChannels = Object.entries(briefs).filter(([k, v]) => {
    const chat = channels[k];
    if (!chat) {
      return false;
    }

    const group = groups[chat.perms.group];
    const channel = group?.channels[k];
    const vessel = group?.fleet[window.our];
    return channel && vessel && canReadChannel(channel, vessel, group.bloc);
  });
  const dms = Object.entries(dmBriefs).filter(([k, v]) => {
    const club = multiDms[k];
    if (club) {
      return club.team.concat(club.hive).includes(window.our);
    }

    return true;
  });

  const unreads = useMemo(() => {
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
      {unreads > 0 ? <title>{`(${unreads}) `}Talk</title> : <title>Talk</title>}
    </Helmet>
  );
}
