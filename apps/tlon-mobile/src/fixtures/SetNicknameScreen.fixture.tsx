import { NavigationContainer } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { SetNicknameScreen } from '../screens/Onboarding/SetNicknameScreen';
import { OnboardingStackParamList, User } from '../types';
import { FixtureWrapper } from './FixtureWrapper';

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
      <FixtureWrapper>
        <SetNicknameScreen
          navigation={mockNavigation}
          route={{
            key: 'SetNickname',
            name: 'SetNickname',
            params: { user: {} as User },
          }}
        />
      </FixtureWrapper>
    </NavigationContainer>
  );
};

export default GroupMetaScreenFixture;
