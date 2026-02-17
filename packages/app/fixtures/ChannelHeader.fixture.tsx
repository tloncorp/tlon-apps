import { ChannelHeader } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { tlonLocalBulletinBoard } from './fakeData';

const channel = tlonLocalBulletinBoard;

function ChannelHeaderFixture() {
  return (
    <FixtureWrapper fillWidth verticalAlign="top" backgroundColor="$background">
      <ChannelHeader
        title={channel.title ?? ''}
        description={channel.description ?? ''}
        channel={channel}
        group={channel.group}
        showSpinner={true}
      />
    </FixtureWrapper>
  );
}

export default <ChannelHeaderFixture />;
