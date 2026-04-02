import { AppDataContextProvider, ChannelHeader } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { tlonLocalBulletinBoard } from './fakeData';

const channel = tlonLocalBulletinBoard;
const shortTitleChannel = {
  ...channel,
  title: 'BB',
};

function ChannelHeaderFixture({
  channelModel = channel,
  showSpinner = true,
  loadingSubtitle = 'Loading messages…',
}: {
  channelModel?: typeof channel;
  showSpinner?: boolean;
  loadingSubtitle?: string;
}) {
  return (
    <AppDataContextProvider currentUserId="~nibset-napwyn">
      <FixtureWrapper
        fillWidth
        verticalAlign="top"
        backgroundColor="$background"
      >
        <ChannelHeader
          title={channelModel.title ?? ''}
          description={channelModel.description ?? ''}
          channel={channelModel}
          group={channelModel.group}
          showSpinner={showSpinner}
          loadingSubtitle={loadingSubtitle}
        />
      </FixtureWrapper>
    </AppDataContextProvider>
  );
}

export default {
  Loading: <ChannelHeaderFixture />,
  Connected: <ChannelHeaderFixture showSpinner={false} />,
  'Loading (Short Title)': (
    <ChannelHeaderFixture
      channelModel={shortTitleChannel}
      loadingSubtitle="Syncing messages and metadata from host..."
    />
  ),
};
