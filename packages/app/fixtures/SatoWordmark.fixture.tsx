import { SatoWordmark } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';

// The welcome screen's size. Switch themeName to dark to see it follow
// $primaryText.
export default (
  <FixtureWrapper
    fillWidth
    fillHeight
    verticalAlign="center"
    horizontalAlign="center"
  >
    <SatoWordmark width={128} height={57} />
  </FixtureWrapper>
);
