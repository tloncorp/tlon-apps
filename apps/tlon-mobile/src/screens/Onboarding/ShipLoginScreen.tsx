import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getLandscapeAuthCookie } from '@tloncorp/api';
import {
  ACCESS_CODE_REGEX,
  DEFAULT_SHIP_LOGIN_ACCESS_CODE,
  DEFAULT_SHIP_LOGIN_URL,
} from '@tloncorp/app/constants';
import { useShip } from '@tloncorp/app/contexts/ship';
import {
  Field,
  KeyboardAvoidingView,
  ScreenHeader,
  SplashParagraph,
  SplashTitle,
  TextInput,
  TlonText,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { getShipFromCookie } from '@tloncorp/app/utils/ship';
import { transformShipURL } from '@tloncorp/app/utils/string';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { storage } from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OnboardingStackParamList } from '../../types';

const logger = createDevLogger('ShipLoginScreen', true);

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ShipLogin'>;

type FormData = {
  shipUrl: string;
  accessCode: string;
  eulaAgreed: boolean;
};

export const ShipLoginScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formattedShipUrl, setFormattedShipUrl] = useState<
    string | undefined
  >();
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const {
    control,
    setFocus,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    trigger,
  } = useForm<FormData>({
    defaultValues: {
      shipUrl: DEFAULT_SHIP_LOGIN_URL,
      accessCode: DEFAULT_SHIP_LOGIN_ACCESS_CODE,
      eulaAgreed: false,
    },
  });
  const { setShip } = useShip();
  const { setValue: setFinishingSelfHostedLogin } =
    storage.finishingSelfHostedLogin.useStorageItem();

  const [codevisible, setCodeVisible] = useState(false);

  const isValidUrl = useCallback((url: string) => {
    const urlPattern =
      /^(https?:\/\/)?(localhost|(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|[\w.-]+\.([a-z]{2,}))(:\d+)?$/i;
    const hostedPattern = /tlon\.network/i;
    if (!urlPattern.test(url)) {
      return false;
    }
    if (hostedPattern.test(url)) {
      return 'hosted';
    }
    return true;
  }, []);

  const handlePressEula = useCallback(() => {
    navigation.navigate('EULA');
  }, [navigation]);

  const onSubmit = handleSubmit(async (params) => {
    const { shipUrl: rawShipUrl, accessCode } = params;
    setIsSubmitting(true);

    storage.eulaAgreed.setValue(true);

    const shipUrl = transformShipURL(rawShipUrl);
    setFormattedShipUrl(shipUrl);
    try {
      const authCookie = await getLandscapeAuthCookie(
        shipUrl,
        accessCode.trim()
      );
      if (authCookie) {
        await setFinishingSelfHostedLogin(true);
        const shipId = getShipFromCookie(authCookie);

        navigation.navigate('SetTelemetry');

        await new Promise((resolve) => setTimeout(resolve, 100));

        setShip({
          ship: shipId,
          shipUrl,
          authCookie,
          authType: 'self',
        });

        const hasSignedUp = await storage.didSignUp.getValue();
        if (!hasSignedUp) {
          logger.trackEvent(AnalyticsEvent.LoggedInBeforeSignup);
        }
      } else {
        setRemoteError(
          "Sorry, we couldn't log in to your ship. It may be busy or offline."
        );
      }
    } catch (err) {
      setRemoteError((err as Error).message);
    }

    setIsSubmitting(false);
  });

  useEffect(() => {
    if (errors.shipUrl && formattedShipUrl) {
      setFocus('shipUrl');
      setValue('shipUrl', formattedShipUrl);
    }
  }, [errors.shipUrl, formattedShipUrl, setFocus, setValue]);

  return (
    <KeyboardAvoidingView keyboardVerticalOffset={0}>
      <View
        flex={1}
        backgroundColor="$background"
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
      >
        <YStack flex={1} gap="$2xl" paddingTop="$2xl">
          <View paddingHorizontal="$xl">
            <ScreenHeader.BackButton
              onPress={isSubmitting ? undefined : () => navigation.goBack()}
            />
          </View>
          <SplashTitle>
            Connect your <Text color="$positiveActionText">ship.</Text>
          </SplashTitle>
          <SplashParagraph marginBottom={0}>
            Connect a self-hosted ship by entering its URL and access code.
          </SplashParagraph>
          <YStack paddingHorizontal="$xl" gap="$2xl">
            {remoteError ? (
              <TlonText.Text size="$label/m" color="$negativeActionText">
                {remoteError}
              </TlonText.Text>
            ) : null}
            <Controller
              control={control}
              name="shipUrl"
              rules={{
                required: 'Please enter a valid URL.',
                validate: (value) => {
                  const urlValidation = isValidUrl(value);
                  if (urlValidation === false) {
                    return 'Please enter a valid URL.';
                  }
                  if (urlValidation === 'hosted') {
                    return 'Please log in to your hosted Tlon ship using email and password.';
                  }
                  return true;
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Field label="Ship URL" error={errors.shipUrl?.message}>
                  <TextInput
                    testID="textInput shipUrl"
                    placeholder="https://sampel-palnet.arvo.network"
                    onBlur={() => {
                      onBlur();
                      trigger('shipUrl');
                    }}
                    onChangeText={onChange}
                    onSubmitEditing={() => setFocus('accessCode')}
                    value={value}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    enablesReturnKeyAutomatically
                  />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="accessCode"
              rules={{
                required: 'Please enter a valid access code.',
                pattern: {
                  value: ACCESS_CODE_REGEX,
                  message: 'Please enter a valid access code.',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Field label="Access Code" error={errors.accessCode?.message}>
                  <TextInput
                    testID="textInput accessCode"
                    placeholder="xxxxxx-xxxxxx-xxxxxx-xxxxxx"
                    onBlur={() => {
                      onBlur();
                      trigger('accessCode');
                    }}
                    onChangeText={onChange}
                    onSubmitEditing={onSubmit}
                    value={value}
                    secureTextEntry={!codevisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="send"
                    enablesReturnKeyAutomatically
                    rightControls={
                      <TextInput.InnerButton
                        label={codevisible ? 'Hide' : 'Show'}
                        onPress={() => setCodeVisible(!codevisible)}
                      />
                    }
                  />
                </Field>
              )}
            />
          </YStack>
        </YStack>
        <YStack paddingHorizontal="$xl" gap="$l" marginTop="$xl">
          <Button
            onPress={onSubmit}
            label={isSubmitting ? 'Connecting…' : 'Connect'}
            preset="hero"
            loading={isSubmitting}
            disabled={!isValid || isSubmitting}
            shadow={isValid && !isSubmitting}
          />
          <TlonText.Text
            size="$label/s"
            color="$tertiaryText"
            textAlign="center"
          >
            By logging in you agree to Tlon&rsquo;s{' '}
            <TlonText.RawText
              pressStyle={{ opacity: 0.5 }}
              textDecorationLine="underline"
              textDecorationDistance={10}
              onPress={handlePressEula}
            >
              Terms of Service
            </TlonText.RawText>
          </TlonText.Text>
        </YStack>
      </View>
    </KeyboardAvoidingView>
  );
};
