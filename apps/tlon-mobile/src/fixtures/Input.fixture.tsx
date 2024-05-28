import { Icon, Input } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';

export default {
  ['Basic']: () => (
    <FixtureWrapper fillWidth>
      <Input size="$m">
        <Input.Area placeholder="Enter details..." />
      </Input>
    </FixtureWrapper>
  ),
  ['With Left Icon']: () => (
    <FixtureWrapper fillWidth>
      <Input>
        <Input.Icon>
          <Icon type="Face" />
        </Input.Icon>
        <Input.Area placeholder="Find pal" />
      </Input>
    </FixtureWrapper>
  ),
};
