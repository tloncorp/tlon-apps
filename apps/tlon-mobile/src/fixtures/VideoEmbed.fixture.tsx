import { VideoEmbed } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';

const VideoEmbedFixture = () => {
  return (
    <FixtureWrapper>
      <VideoEmbed
        video={{
          src: 'https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4',
          width: 640,
          height: 360,
        }}
      />
    </FixtureWrapper>
  );
};

const VideoEmbedFixtureNoVideo = () => {
  return (
    <FixtureWrapper>
      <VideoEmbed video={{ src: '', width: 100, height: 100 }} />
    </FixtureWrapper>
  );
};

export default {
  basic: <VideoEmbedFixture />,
  noVideo: <VideoEmbedFixtureNoVideo />,
};
