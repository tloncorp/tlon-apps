import { VideoPreview } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';

const VideoPreviewFixture = () => {
  return (
    <FixtureWrapper>
      <VideoPreview
        video={{
          src: 'https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4',
          width: 640,
          height: 360,
        }}
      />
    </FixtureWrapper>
  );
};

const VideoPreviewFixtureNoVideo = () => {
  return (
    <FixtureWrapper>
      <VideoPreview video={{ src: '', width: 100, height: 100 }} />
    </FixtureWrapper>
  );
};

export default {
  basic: <VideoPreviewFixture />,
  noVideo: <VideoPreviewFixtureNoVideo />,
};
