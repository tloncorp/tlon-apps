import { ChannelHeader } from '@tloncorp/ui/src/components/Channel/ChannelHeader';

import { tlonLocalBulletinBoard } from './fakeData';

const channel = tlonLocalBulletinBoard;

export default <ChannelHeader title={channel.title ?? ''} />;
