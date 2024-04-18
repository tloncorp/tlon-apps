import { TlonButton } from '../components/TlonButton';
import { FixtureWrapper } from './FixtureWrapper';

export default {
  primary: () => (
    <FixtureWrapper fillWidth>
      <TlonButton title="Button" />
    </FixtureWrapper>
  ),
  secondary: () => (
    <FixtureWrapper fillWidth>
      <TlonButton title="Button" variant="secondary" />
    </FixtureWrapper>
  ),
  minimal: () => (
    <FixtureWrapper fillWidth>
      <TlonButton title="Button" variant="minimal" />
    </FixtureWrapper>
  ),
};
