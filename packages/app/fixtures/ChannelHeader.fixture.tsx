import { ChannelHeader } from '../ui';

import { tlonLocalBulletinBoard } from './fakeData';

const channel = tlonLocalBulletinBoard;

export default (
  <ChannelHeader
    title={channel.title ?? ''}
    channel={channel}
    showSearchButton={true}
    showSpinner={true}
  />
);
