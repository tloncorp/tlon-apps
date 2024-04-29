import { ChannelSwitcherSheet } from '@tloncorp/ui';

import { group, initialContacts } from './fakeData';

export default {
  basic: (
    <ChannelSwitcherSheet
      open
      onOpenChange={() => {}}
      group={group}
      channels={group.channels!}
      contacts={initialContacts}
      onSelect={(channel) => console.debug(`Selected ${channel.title}`)}
    />
  ),
};
