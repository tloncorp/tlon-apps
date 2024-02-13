import { useGroup, useVessel } from '@/state/groups';

import { canReadChannel } from './channel';
import { useChannelSections, useCheckChannelJoined } from './channel';

const useFilteredSections = (flag: string, filterJoined?: boolean) => {
  const { sections, sectionedChannels } = useChannelSections(flag);
  const group = useGroup(flag);
  const vessel = useVessel(flag, window.our);
  const isChannelJoined = useCheckChannelJoined();

  const filteredSections = sections.filter(
    (s) =>
      sectionedChannels[s] &&
      sectionedChannels[s].some((sectionedChan) => {
        if (filterJoined) {
          return (
            sectionedChan[1] &&
            canReadChannel(sectionedChan[1], vessel, group?.bloc) &&
            isChannelJoined(sectionedChan[0])
          );
        }
        return (
          sectionedChan[1] &&
          canReadChannel(sectionedChan[1], vessel, group?.bloc)
        );
      })
  );
  return filteredSections;
};

export default useFilteredSections;
