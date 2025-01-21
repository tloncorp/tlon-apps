import { NavigationContainer } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FixtureWrapper } from '@tloncorp/app/fixtures/FixtureWrapper';

import { SetNicknameScreen } from '../screens/Onboarding/SetNicknameScreen';
import { OnboardingStackParamList, User } from '../types';

const GroupMetaScreenFixture = () => {
  const mockNavigation = {
    navigate: () => {},
    goBack: () => {},
    addListener: () => {},
  } as unknown as NativeStackNavigationProp<
    OnboardingStackParamList,
    'SetNickname'
  >;

  return (
    <NavigationContainer>
      <FixtureWrapper safeArea={false}>
        <SetNicknameScreen
          navigation={mockNavigation}
          route={{
            key: 'SetNickname',
            name: 'SetNickname',
          }}
        />
      </FixtureWrapper>
    </NavigationContainer>
  );
};

export default GroupMetaScreenFixture;
