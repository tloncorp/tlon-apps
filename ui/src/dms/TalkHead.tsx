import { useMemo } from 'react';
import _ from 'lodash';
import { Helmet } from 'react-helmet';
import { useMessagesFilter } from '@/state/settings';
import { useBriefs, useShelf } from '@/state/channel/channel';
import { useDmBriefs, useMultiDms } from '@/state/chat';
import { useGroups } from '@/state/groups';
import { canReadChannel } from '@/logic/channel';

export default function TalkHead() {
  const messagesFilter = useMessagesFilter();
  const briefs = useBriefs();
  const dmBriefs = useDmBriefs();
  const shelf = useShelf();
  const multiDms = useMultiDms();
  const groups = useGroups();
  const channels = Object.entries(briefs).filter(([k, v]) => {
    const chat = shelf[k];
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
        return _.sumBy(Object.values(_.concat(channels, dms)), 'count');
      case 'Group Channels':
        return _.sumBy(Object.values(channels), 'count');
      case 'Direct Messages':
        return _.sumBy(Object.values(dms), 'count');
      default:
        return _.sumBy(Object.values(_.concat(channels, dms)), 'count');
    }
  }, [messagesFilter, channels, dms]);

  return (
    <Helmet defer={false}>
      {unreads > 0 ? <title>{`(${unreads}) `}Talk</title> : <title>Talk</title>}
    </Helmet>
  );
}
