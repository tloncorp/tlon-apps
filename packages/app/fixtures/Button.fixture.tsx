import { Button } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';

export default {
  primary: () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button>
        <Button.Text>Primary</Button.Text>
      </Button>
    </FixtureWrapper>
  ),
  text: () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button minimal>
        <Button.Text>Text Button</Button.Text>
      </Button>
    </FixtureWrapper>
  ),
  hero: () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button hero>
        <Button.Text>Hero Button</Button.Text>
      </Button>
    </FixtureWrapper>
  ),
  heroDisabled: () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button hero disabled>
        <Button.Text>Hero Button</Button.Text>
      </Button>
    </FixtureWrapper>
  ),
};
