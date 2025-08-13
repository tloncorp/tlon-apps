import { ChannelHeader } from '../ui';
import { tlonLocalBulletinBoard } from './fakeData';

const channel = tlonLocalBulletinBoard;

export default (
  <ChannelHeader
    title={channel.title ?? ''}
    description={channel.description ?? ''}
    channel={channel}
    showSpinner={true}
  />
);
