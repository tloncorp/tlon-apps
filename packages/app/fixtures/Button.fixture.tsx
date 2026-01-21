import { Button } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';

export default {
  // Presets
  'preset/hero': () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="hero" label="Hero Button" />
    </FixtureWrapper>
  ),
  'preset/primary': () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="primary" label="Primary Button" />
    </FixtureWrapper>
  ),
  'preset/secondary': () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="secondary" label="Secondary Button" />
    </FixtureWrapper>
  ),
  'preset/outline': () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="outline" label="Outline Button" />
    </FixtureWrapper>
  ),
  'preset/secondaryOutline': () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="secondaryOutline" label="Secondary Outline" />
    </FixtureWrapper>
  ),
  'preset/destructive': () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="destructive" label="Destructive Button" />
    </FixtureWrapper>
  ),
  'preset/minimal': () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="minimal" label="Minimal Button" />
    </FixtureWrapper>
  ),
  'preset/destructiveMinimal': () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="destructiveMinimal" label="Destructive Minimal" />
    </FixtureWrapper>
  ),
  // Disabled states
  'disabled/hero': () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="hero" disabled label="Disabled Hero" />
    </FixtureWrapper>
  ),
  'disabled/primary': () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="primary" disabled label="Disabled Primary" />
    </FixtureWrapper>
  ),
  // With icons
  'icons/leading': () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="outline" leadingIcon="Settings" label="Settings" />
    </FixtureWrapper>
  ),
  'icons/trailing': () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="primary" trailingIcon="ChevronRight" label="Continue" />
    </FixtureWrapper>
  ),
  // Centered
  centered: () => (
    <FixtureWrapper fillWidth safeArea={false}>
      <Button preset="primary" label="Centered Button" centered />
    </FixtureWrapper>
  ),
};
