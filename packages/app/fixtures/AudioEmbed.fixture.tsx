import { AudioEmbed } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';

const AudioEmbedFixture = () => {
  return (
    <FixtureWrapper>
      <AudioEmbed url="https://ia800501.us.archive.org/11/items/popeye_i_dont_scare/popeye_i_dont_scare_512kb.mp4" />
    </FixtureWrapper>
  );
};

const AudioEmbedFixtureNoAudio = () => {
  return (
    <FixtureWrapper>
      <AudioEmbed url="" />
    </FixtureWrapper>
  );
};

export default {
  basic: <AudioEmbedFixture />,
  noAudio: <AudioEmbedFixtureNoAudio />,
};
