import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_TLON_LOGIN_EMAIL,
  DEFAULT_TLON_LOGIN_PASSWORD,
} from '@tloncorp/app/constants';
import { useShip } from '@tloncorp/app/contexts/ship';
import {
  getShipAccessCode,
  getShipsWithStatus,
  logInHostingUser,
  requestPhoneVerify,
} from '@tloncorp/app/lib/hostingApi';
import { isEulaAgreed } from '@tloncorp/app/utils/eula';
import { getShipUrl } from '@tloncorp/app/utils/ship';
import { getLandscapeAuthCookie } from '@tloncorp/shared/dist/api';
import {
  Button,
  GenericHeader,
  Input,
  KeyboardAvoidingView,
  SizableText,
  Text,
  View,
  YStack,
} from '@tloncorp/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'TlonLogin'>;

type FormData = {
  email: string;
  password: string;
};

export const TlonLoginScreen = ({ navigation }: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
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
                      authCookie,
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

  return (
    <View flex={1}>
      <GenericHeader
        title="Login"
        goBack={() => navigation.goBack()}
        showSpinner={isSubmitting}
        rightContent={
          <Button minimal onPress={onSubmit}>
            <Text fontSize={'$m'}>Connect</Text>
          </Button>
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={90}>
        <YStack gap="$2xl" padding="$2xl">
          <SizableText color="$primaryText">
            Enter the email and password associated with your Tlon account.
          </SizableText>
          {remoteError ? (
            <SizableText color="$negativeActionText">{remoteError}</SizableText>
          ) : null}
          <View>
            <SizableText marginBottom="$m">Email</SizableText>
            <Controller
              control={control}
              rules={{
                required: 'Please enter a valid email address.',
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input height="$4xl">
                  <Input.Area
                    placeholder="Email Address"
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
                </Input>
              )}
              name="email"
            />
            {errors.email && (
              <SizableText
                color="$negativeActionText"
                marginTop="$m"
                fontSize="$s"
              >
                {errors.email.message}
              </SizableText>
            )}
          </View>
          <View>
            <SizableText marginBottom="$m">Password</SizableText>
            <Controller
              control={control}
              rules={{
                required: 'Please enter a password.',
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input height="$4xl">
                  <Input.Area
                    placeholder="Password"
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
                </Input>
              )}
              name="password"
            />
            {errors.password && (
              <SizableText
                color="$negativeActionText"
                marginTop="$m"
                fontSize="$s"
              >
                {errors.password.message}
              </SizableText>
            )}
          </View>
          <Button minimal onPress={handleForgotPassword}>
            <SizableText color="$primaryText">Forgot password?</SizableText>
          </Button>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
