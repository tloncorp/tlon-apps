import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DEFAULT_TLON_LOGIN_EMAIL,
  DEFAULT_TLON_LOGIN_PASSWORD,
  EMAIL_REGEX,
} from '@tloncorp/app/constants';
import { useShip } from '@tloncorp/app/contexts/ship';
import {
  getShipAccessCode,
  getShipsWithStatus,
  logInHostingUser,
  requestPhoneVerify,
} from '@tloncorp/app/lib/hostingApi';
import { isEulaAgreed, setEulaAgreed } from '@tloncorp/app/utils/eula';
import { getShipUrl } from '@tloncorp/app/utils/ship';
import { getLandscapeAuthCookie } from '@tloncorp/shared/dist/api';
import {
  CheckboxInput,
  Field,
  Icon,
  KeyboardAvoidingView,
  ListItem,
  ScreenHeader,
  SizableText,
  TextInput,
  View,
  YStack,
} from '@tloncorp/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'TlonLogin'>;

type FormData = {
  email: string;
  password: string;
  eulaAgreed: boolean;
};

export const TlonLoginScreen = ({ navigation }: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const {
    control,
    setFocus,
    handleSubmit,
    formState: { errors, isValid },
    getValues,
    trigger,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      email: DEFAULT_TLON_LOGIN_EMAIL,
      password: DEFAULT_TLON_LOGIN_PASSWORD,
      eulaAgreed: false,
    },
    mode: 'onChange',
  });
  const { setShip } = useShip();

  const handleForgotPassword = () => {
    const { email } = getValues();
    navigation.navigate('ResetPassword', { email });
  };

  const handleEula = () => {
    navigation.navigate('EULA');
  };

  const onSubmit = handleSubmit(async (params) => {
    setIsSubmitting(true);

    if (params.eulaAgreed) {
      await setEulaAgreed();
    }

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
                  setRemoteError(
                    'Please agree to the End User License Agreement to continue.'
                  );
                }
              } else {
                setRemoteError(
                  "Sorry, we couldn't log you into your Tlon account."
                );
              }
            } else {
              navigation.navigate('ReserveShip', { user });
            }
          } else {
            setRemoteError(
              "Sorry, we couldn't find an active Tlon ship for your account."
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
      <ScreenHeader
        title="Login"
        showSessionStatus={false}
        backAction={() => navigation.goBack()}
        isLoading={isSubmitting}
        rightControls={
          isValid &&
          watch('eulaAgreed') && (
            <ScreenHeader.TextButton onPress={onSubmit}>
              Connect
            </ScreenHeader.TextButton>
          )
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

          <Controller
            control={control}
            rules={{
              required: 'Please enter a valid email address.',
              pattern: {
                value: EMAIL_REGEX,
                message: 'Please enter a valid email address.',
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Field label="Email" error={errors.email?.message}>
                <TextInput
                  placeholder="Email Address"
                  onBlur={() => {
                    onBlur();
                    trigger('email');
                  }}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('password')}
                  value={value}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  enablesReturnKeyAutomatically
                />
              </Field>
            )}
            name="email"
          />
          <Controller
            control={control}
            rules={{
              required: 'Please enter a password.',
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Field label="Password" error={errors.password?.message}>
                <TextInput
                  placeholder="Password"
                  onBlur={() => {
                    onBlur();
                    trigger('password');
                  }}
                  onChangeText={onChange}
                  onSubmitEditing={onSubmit}
                  value={value}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  enablesReturnKeyAutomatically
                />
              </Field>
            )}
            name="password"
          />
          <Controller
            control={control}
            name="eulaAgreed"
            render={({ field: { onChange, value } }) => (
              <CheckboxInput
                option={{
                  title:
                    'I have read and agree to the End User License Agreement',
                  value: 'agreed',
                }}
                checked={value}
                onChange={() => onChange(!value)}
              />
            )}
          />
          <YStack>
            <ListItem onPress={handleEula}>
              <ListItem.MainContent>
                <ListItem.Title>End User License Agreement</ListItem.Title>
              </ListItem.MainContent>
              <ListItem.EndContent>
                <Icon type="ChevronRight" color="$primaryText" />
              </ListItem.EndContent>
            </ListItem>
            <ListItem onPress={handleForgotPassword}>
              <ListItem.MainContent>
                <ListItem.Title>Forgot password?</ListItem.Title>
              </ListItem.MainContent>
              <ListItem.EndContent>
                <Icon type="ChevronRight" color="$primaryText" />
              </ListItem.EndContent>
            </ListItem>
          </YStack>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
