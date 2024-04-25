import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getLandscapeAuthCookie } from '@tloncorp/shared/dist/api';
import { useLayoutEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import { HeaderButton } from '../components/HeaderButton';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  DEFAULT_TLON_LOGIN_EMAIL,
  DEFAULT_TLON_LOGIN_PASSWORD,
} from '../constants';
import { useShip } from '../contexts/ship';
import {
  getShipAccessCode,
  getShipsWithStatus,
  logInHostingUser,
  requestPhoneVerify,
} from '../lib/hostingApi';
import type { OnboardingStackParamList } from '../types';
import { isEulaAgreed } from '../utils/eula';
import { getShipUrl } from '../utils/ship';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'TlonLogin'>;

type FormData = {
  email: string;
  password: string;
};

export const TlonLoginScreen = ({ navigation }: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const tailwind = useTailwind();
  const {
    control,
    setFocus,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<FormData>({
    defaultValues: {
      email: DEFAULT_TLON_LOGIN_EMAIL,
      password: DEFAULT_TLON_LOGIN_PASSWORD,
    },
  });
  const { setShip } = useShip();

  const handleForgotPassword = () => {
    const { email } = getValues();
    navigation.navigate('ResetPassword', { email });
  };

  const onSubmit = handleSubmit(async (params) => {
    setIsSubmitting(true);

    try {
      const user = await logInHostingUser(params);
      if (user.verified) {
        if (user.ships.length > 0) {
          const shipsWithStatus = await getShipsWithStatus(user.ships);
          if (shipsWithStatus) {
            const { status, shipId } = shipsWithStatus;
            if (status === 'Ready') {
              const { code: accessCode } = await getShipAccessCode(shipId);
              const shipUrl = getShipUrl(shipId);
              const authCookie = await getLandscapeAuthCookie(
                shipUrl,
                accessCode
              );
              if (authCookie) {
                if (await isEulaAgreed()) {
                  setShip(
                    {
                      ship: shipId,
                      shipUrl,
                    },
                    authCookie
                  );
                } else {
                  navigation.navigate('EULA', { shipId, shipUrl, authCookie });
                }
              } else {
                setRemoteError(
                  "Sorry, we couldn't log you into your Urbit ID."
                );
              }
            } else {
              navigation.navigate('ReserveShip', { user });
            }
          } else {
            setRemoteError(
              "Sorry, we couldn't find an active Urbit ID for your account."
            );
          }
        } else {
          navigation.navigate('ReserveShip', { user });
        }
      } else if (user.requirePhoneNumberVerification && !user.phoneNumber) {
        navigation.navigate('RequestPhoneVerify', { user });
      } else {
        if (user.requirePhoneNumberVerification) {
          await requestPhoneVerify(user.id, user.phoneNumber ?? '');
        }

        navigation.navigate('CheckVerify', {
          user,
        });
      }
    } catch (err: any) {
      if ('name' in err && err.name === 'AbortError') {
        setRemoteError(
          'Sorry, we could not connect to the server. Please try again later.'
        );
      } else {
        setRemoteError((err as Error).message);
      }
    }

    setIsSubmitting(false);
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isSubmitting ? (
          <View style={tailwind('px-8')}>
            <LoadingSpinner height={16} />
          </View>
        ) : (
          <HeaderButton title="Connect" onPress={onSubmit} isSubmit />
        ),
    });
  }, [navigation, isSubmitting]);

  return (
    <View style={tailwind('p-6 h-full bg-white dark:bg-black')}>
      <Text
        style={tailwind(
          'text-lg font-medium text-tlon-black-80 dark:text-white'
        )}
      >
        Enter the email and password associated with your Tlon account.
      </Text>
      {remoteError ? (
        <Text style={tailwind('mt-4 text-tlon-red')}>{remoteError}</Text>
      ) : null}
      <View style={tailwind('mt-8')}>
        <Text
          style={tailwind(
            'mb-2 text-lg font-medium text-tlon-black-80 dark:text-white'
          )}
        >
          Email
        </Text>
        <Controller
          control={control}
          rules={{
            required: 'Please enter a valid email address.',
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={tailwind(
                'p-4 text-tlon-black-80 dark:text-white border border-tlon-black-20 dark:border-tlon-black-80 rounded-lg'
              )}
              placeholder="Email Address"
              placeholderTextColor="#999999"
              onBlur={onBlur}
              onChangeText={onChange}
              onSubmitEditing={() => setFocus('password')}
              value={value}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              enablesReturnKeyAutomatically
            />
          )}
          name="email"
        />
        {errors.email ? (
          <Text style={tailwind('mt-2 text-tlon-red')}>
            {errors.email.message}
          </Text>
        ) : null}
      </View>
      <View style={tailwind('mt-8')}>
        <Text
          style={tailwind(
            'mb-2 text-lg font-medium text-tlon-black-80 dark:text-white'
          )}
        >
          Password
        </Text>
        <Controller
          control={control}
          rules={{
            required: 'Please enter a password.',
          }}
          render={({ field: { ref, onChange, onBlur, value } }) => (
            <TextInput
              ref={ref}
              style={tailwind(
                'p-4 text-tlon-black-80 dark:text-white border border-tlon-black-20 dark:border-tlon-black-80 rounded-lg'
              )}
              placeholder="Password"
              placeholderTextColor="#999999"
              onBlur={onBlur}
              onChangeText={onChange}
              onSubmitEditing={onSubmit}
              value={value}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              enablesReturnKeyAutomatically
            />
          )}
          name="password"
        />
        {errors.password ? (
          <Text style={tailwind('mt-2 text-tlon-red')}>
            {errors.password.message}
          </Text>
        ) : null}
      </View>
      <View style={tailwind('mt-6')}>
        <Text
          style={tailwind('text-lg font-medium text-tlon-black-40')}
          onPress={handleForgotPassword}
        >
          Forgot password?
        </Text>
      </View>
    </View>
  );
};
