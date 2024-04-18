import { HeaderButton } from '../components/HeaderButton';
import { FixtureWrapper } from './FixtureWrapper';

export default {
  primary: () => (
    <FixtureWrapper>
      <HeaderButton title="Button" onPress={() => console.log('press')} />
    </FixtureWrapper>
  ),
};
