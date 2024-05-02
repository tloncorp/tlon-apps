import { QueryClientProvider, queryClient } from '@tloncorp/shared';
import { OutsideEmbed } from '@tloncorp/ui';
import { PropsWithChildren } from 'react';

import { FixtureWrapper } from './FixtureWrapper';

const OutsideEmbedFixtureWrapper = ({ children }: PropsWithChildren) => {
  return (
    <FixtureWrapper>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </FixtureWrapper>
  );
};

const YoutubeEmbedFixture = () => {
  return (
    <OutsideEmbedFixtureWrapper>
      <OutsideEmbed url="https://www.youtube.com/watch?v=3K3D9LGzvBA" />
    </OutsideEmbedFixtureWrapper>
  );
};

const SpotifyEmbedFixture = () => {
  return (
    <OutsideEmbedFixtureWrapper>
      <OutsideEmbed url="https://open.spotify.com/track/1k7lK8tjU5BPsXez7WEpg0?si=21cac0122b5141f0" />
    </OutsideEmbedFixtureWrapper>
  );
};

const TwitterEmbedFixture = () => {
  return (
    <OutsideEmbedFixtureWrapper>
      <OutsideEmbed url="https://x.com/tloncorporation/status/1768691579794157746" />
    </OutsideEmbedFixtureWrapper>
  );
};

export default {
  youtube: <YoutubeEmbedFixture />,
  spotify: <SpotifyEmbedFixture />,
  twitter: <TwitterEmbedFixture />,
};
