import { SearchBar } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';

export default {
  base: (
    <FixtureWrapper fillWidth fillHeight>
      <SearchBar
        onChangeQuery={() => {}}
        placeholder="Search in Internet Cafe..."
      />
    </FixtureWrapper>
  ),
};
