import { GestureMediaViewer } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';

const items = [
  {
    id: 'example-image',
    type: 'image' as const,
    uri: 'https://d2w9rnfcy7mm78.cloudfront.net/25296321/original_81eb3ac8a95ce36dc8d64b1038234ec8.jpg',
  },
];

export default {
  basic: (
    <FixtureWrapper fillWidth fillHeight innerBackgroundColor="$black">
      <GestureMediaViewer items={items} />
    </FixtureWrapper>
  ),
};
