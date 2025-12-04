import { Button } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';

export default {
  primary: () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button fill="outline" type="primary" label="Primary" />
    </FixtureWrapper>
  ),
  text: () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button fill="text" type="primary" label="Text Button" />
    </FixtureWrapper>
  ),
  hero: () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button fill="solid" type="primary" label="Hero Button" centered />
    </FixtureWrapper>
  ),
  heroDisabled: () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button fill="solid" type="primary" disabled label="Hero Button" centered />
    </FixtureWrapper>
  ),
};
