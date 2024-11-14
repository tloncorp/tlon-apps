import { ImageViewerScreenView } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';

export default {
  basic: (
    <FixtureWrapper fillWidth fillHeight>
      <ImageViewerScreenView
        goBack={() => {}}
        uri="https://d2w9rnfcy7mm78.cloudfront.net/25296321/original_81eb3ac8a95ce36dc8d64b1038234ec8.jpg"
      />
    </FixtureWrapper>
  ),
};
