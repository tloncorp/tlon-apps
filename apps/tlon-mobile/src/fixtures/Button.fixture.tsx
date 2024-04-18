import { Button } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';

export default {
  primary: () => (
    <FixtureWrapper fillWidth>
      <Button>
        <Button.Text>Primary</Button.Text>
      </Button>
    </FixtureWrapper>
  ),
  text: () => (
    <FixtureWrapper fillWidth>
      <Button minimal>
        <Button.Text>Text Button</Button.Text>
      </Button>
    </FixtureWrapper>
  ),
};
