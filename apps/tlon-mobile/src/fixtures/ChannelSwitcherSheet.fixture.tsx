import { ChannelSwitcherSheet } from '@tloncorp/ui';

export default {
  basic: (
    <ChannelSwitcherSheet
      open
      onOpenChange={() => {}}
      group={{ id: '1', title: 'My Group', isSecret: false }}
      channels={[
        {
          id: '1',
          title: 'Channel A',
        },
        {
          id: '2',
          title: 'Channel B',
        },
        {
          id: '3',
          title: 'Channel C',
          image: 'https://picsum.photos/128/128',
        },
      ]}
      onSelect={(channel) => console.debug(`Selected ${channel.title}`)}
    />
  ),
};
