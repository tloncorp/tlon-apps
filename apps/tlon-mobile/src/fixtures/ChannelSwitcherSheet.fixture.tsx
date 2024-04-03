import { ChannelSwitcherSheet } from '@tloncorp/ui';

import { group } from './fakeData';

export default {
  basic: (
    <ChannelSwitcherSheet
      open
      onOpenChange={() => {}}
      group={group}
      channels={group.channels}
      onSelect={(channel) => console.debug(`Selected ${channel.title}`)}
    />
  ),
};
