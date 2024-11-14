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
  hero: () => (
    <FixtureWrapper fillWidth>
      <Button hero>
        <Button.Text>Hero Button</Button.Text>
      </Button>
    </FixtureWrapper>
  ),
  heroDisabled: () => (
    <FixtureWrapper fillWidth>
      <Button hero disabled>
        <Button.Text>Hero Button</Button.Text>
      </Button>
    </FixtureWrapper>
  ),
};
