import { Icon } from '@tloncorp/ui';
import { Input } from '@tloncorp/ui/src/components/Input';

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
