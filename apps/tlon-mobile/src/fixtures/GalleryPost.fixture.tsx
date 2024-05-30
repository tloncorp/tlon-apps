import { GalleryPost } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { createFakePost } from './fakeData';

const GalleryPostFixture = () => (
  <FixtureWrapper fillWidth>
    <GalleryPost
      post={createFakePost(
        'block',
        undefined,
        'https://togten.com:9001/finned-palmer/dotnet-botnet-finned-palmer/2024.5.17..14.23.15..7fbe.76c8.b439.5810-Gabriel-Goller-Unsplash.jpg'
      )}
    />
  </FixtureWrapper>
);

export default {
  default: GalleryPostFixture,
};
