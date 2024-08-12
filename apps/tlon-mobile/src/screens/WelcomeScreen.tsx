import BottomSheet from '@gorhom/bottom-sheet';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsDarkMode } from '@tloncorp/app/hooks/useIsDarkMode';
import cn from 'classnames';
import { useRef } from 'react';
import {
  Animated,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTailwind } from 'tailwind-rn';

import { TlonButton } from '../components/TlonButton';
import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export const WelcomeScreen = ({ navigation }: Props) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const tailwind = useTailwind();
  const isDarkMode = useIsDarkMode();
  const overlayOpacity = new Animated.Value(0);

  const bgSource = isDarkMode
    ? require('../../assets/images/welcome-bg-dark.png')
    : require('../../assets/images/welcome-bg.png');

  return (
    <View style={tailwind('flex-1 p-0 relative')}>
      <ImageBackground style={tailwind('flex-1 p-0')} source={bgSource}>
        <View style={tailwind('h-full pb-8 justify-end')}>
          <View style={tailwind('items-center')}>
            <Pressable
              style={({ pressed }) => [
                tailwind(
                  cn(
                    'bg-tlon-blue rounded-lg py-3 w-3/4 mx-auto',
                    pressed && 'bg-tlon-blue-active'
                  )
                ),
                shadowStyles.button,
              ]}
              onPress={() => navigation.navigate('SignUpEmail')}
            >
              <Text
                style={tailwind('text-lg font-medium text-white text-center')}
              >
                Sign Up with Email
              </Text>
            </Pressable>
            <Pressable
              style={tailwind('p-3 mb-2 mt-12')}
              onPress={() => bottomSheetRef.current?.expand()}
            >
              {({ pressed }) => (
                <Text
                  style={tailwind(
                    cn(
                      'text-lg font-medium text-center',
                      pressed
                        ? 'text-tlon-black-60 dark:text-white'
                        : 'text-tlon-black-80 dark:text-white'
                    )
                  )}
                >
                  Have an account? Log in
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ImageBackground>
      <Animated.View
        style={[
          tailwind('absolute top-0 left-0 w-full h-full bg-black'),
          { opacity: overlayOpacity },
        ]}
        pointerEvents="none"
      />
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['30%']}
        backgroundStyle={tailwind('bg-white dark:bg-black')}
        handleIndicatorStyle={tailwind('bg-tlon-black-10')}
        onAnimate={(_, toIndex) =>
          Animated.spring(overlayOpacity, {
            toValue: toIndex === -1 ? 0 : 0.3,
            useNativeDriver: true,
          }).start()
        }
        enablePanDownToClose
      >
        <View style={tailwind('p-6')}>
          <TlonButton
            title="Log in with Email"
            onPress={() => {
              navigation.navigate('TlonLogin');
              bottomSheetRef.current?.close();
            }}
          />
          <View style={tailwind('mt-2.5')} />
          <TlonButton
            title="Configure self-hosted"
            variant="secondary"
            onPress={() => {
              navigation.navigate('ShipLogin');
              bottomSheetRef.current?.close();
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
};

const shadowStyles = StyleSheet.create({
  button: {
    shadowColor: '#000',
    shadowOffset: {
      width: 5,
      height: 20,
    },
    shadowOpacity: 0.1,
    shadowRadius: 7,
    elevation: 6,
  },
});
