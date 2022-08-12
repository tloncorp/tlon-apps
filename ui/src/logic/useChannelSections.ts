import { useGroup } from '@/state/groups';
import { GroupChannel } from '@/types/groups';
import { groupBy } from 'lodash';

const UNZONED = 'default';

export default function useChannelSections(groupFlag: string) {
  const group = useGroup(groupFlag);

  if (!group) {
    return {
      sections: [],
      sectionedChannels: {},
    };
  }

  const sections = [...group['zone-ord']];
  const sectionedChannels = groupBy(
    Object.entries(group.channels),
    ([, ch]) => ch.zone
  );

  // unsectioned channels have zone 'null' after groupBy; replace with empty str
  // if ('null' in sectionedChannels) {
  //   sectionedChannels[UNZONED] = sectionedChannels.null;
  //   delete sectionedChannels.null;
  // }

  Object.entries(sectionedChannels).forEach((section) => {
    const oldOrder = section[1];
    const zone = section[0];
    const sortedChannels: [string, GroupChannel][] = [];
    group.zones[zone].idx.forEach((nest) => {
      const match = oldOrder.find((n) => n[0] === nest);
      if (match) {
        sortedChannels.push(match);
      }
    });
    sectionedChannels[zone] = sortedChannels;
  });

  return {
    sectionedChannels,
    sections,
  };
}
