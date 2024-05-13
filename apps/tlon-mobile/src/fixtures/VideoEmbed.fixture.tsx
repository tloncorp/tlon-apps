import { VideoEmbed } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';

const VideoEmbedFixture = () => {
  return (
    <FixtureWrapper>
      <VideoEmbed url="https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4" />
    </FixtureWrapper>
  );
};

const VideoEmbedFixtureNoVideo = () => {
  return (
    <FixtureWrapper>
      <VideoEmbed url="" />
    </FixtureWrapper>
  );
};

export default {
  basic: <VideoEmbedFixture />,
  noVideo: <VideoEmbedFixtureNoVideo />,
};
