import { QueryClientProvider, queryClient } from '@tloncorp/shared';
import { PropsWithChildren } from 'react';

import { EmbedContent } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';

const EmbedContentFixtureWrapper = ({ children }: PropsWithChildren) => {
  return (
    <FixtureWrapper>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </FixtureWrapper>
  );
};

const YoutubeEmbedFixture = () => {
  return (
    <EmbedContentFixtureWrapper>
      <EmbedContent url="https://www.youtube.com/watch?v=3K3D9LGzvBA" />
    </EmbedContentFixtureWrapper>
  );
};

const SpotifyEmbedFixture = () => {
  return (
    <EmbedContentFixtureWrapper>
      <EmbedContent url="https://open.spotify.com/track/1k7lK8tjU5BPsXez7WEpg0?si=21cac0122b5141f0" />
    </EmbedContentFixtureWrapper>
  );
};

const TwitterEmbedFixture = () => {
  return (
    <EmbedContentFixtureWrapper>
      <EmbedContent url="https://x.com/tloncorporation/status/1768691579794157746" />
    </EmbedContentFixtureWrapper>
  );
};

export default {
  youtube: <YoutubeEmbedFixture />,
  spotify: <SpotifyEmbedFixture />,
  twitter: <TwitterEmbedFixture />,
};
