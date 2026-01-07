import { ACCESS_CODE_REGEX } from '@tloncorp/app/constants';
import { useShip } from '@tloncorp/app/contexts/ship';
import { Button, Field, Text, TextInput, View, YStack } from '@tloncorp/app/ui';
import { getShipFromCookie } from '@tloncorp/app/utils/ship';
import { transformShipURL } from '@tloncorp/app/utils/string';
import { storeAuthInfo } from '@tloncorp/shared';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { loginToShip, setUrbitShip } from '../electron-bridge';

interface DesktopLoginScreenProps {
  onLoginSuccess: (data: {
    ship: string;
    shipUrl: string;
    authCookie: string;
  }) => void;
}

type FormData = {
  shipUrl: string;
  accessCode: string;
};

export const DesktopLoginScreen = ({
  onLoginSuccess,
}: DesktopLoginScreenProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const [codeVisible, setCodeVisible] = useState(false);
  const { setShip } = useShip();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    trigger,
  } = useForm<FormData>({
    defaultValues: {
      shipUrl: '',
      accessCode: '',
    },
  });

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

  const onSubmit = handleSubmit(async (params) => {
    const { shipUrl: rawShipUrl, accessCode } = params;
    setIsSubmitting(true);
    setRemoteError(undefined);

    const shipUrl = transformShipURL(rawShipUrl);

    try {
      const authCookie = await loginToShip(shipUrl, accessCode.trim());

      if (authCookie) {
        const shipId = getShipFromCookie(authCookie);
        
        // Store authentication info in Electron
        await setUrbitShip(shipUrl);
        try {
          const stored = await storeAuthInfo({
            ship: shipId,
            shipUrl,
            authCookie,
          });
          if (stored) {
            console.log('Successfully stored auth credentials');
          } else {
            console.warn('Failed to store auth credentials');
          }
        } catch (error) {
          console.error('Error storing auth credentials:', error);
        }
        
        // Set ship context
        setShip({
          ship: shipId,
          shipUrl,
          authCookie,
          authType: 'self',
        });
        
        onLoginSuccess({
          ship: shipId,
          shipUrl,
          authCookie,
        });
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

  return (
    <View
      height="100%"
      width="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor="$secondaryBackground"
    >
      <View
        backgroundColor="$background"
        padding="$xl"
        borderRadius="$l"
        width={400}
        borderWidth={1}
        borderColor="$border"
      >
        <YStack gap="$m" width="100%">
          <Text fontSize="$l" color="$primaryText" textAlign="center">
            Connect to Your Ship
          </Text>

          <Text fontSize="$m" color="$primaryText" textAlign="center">
            Connect a self-hosted ship by entering its URL and access code.
          </Text>

          {remoteError ? (
            <Text fontSize="$m" color="$negativeActionText" textAlign="center">
              {remoteError}
            </Text>
          ) : null}

          <YStack gap="$xl" paddingVertical="$xl">
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
                  // disabled until we add hosted login
                  // if (urlValidation === 'hosted') {
                  //   return 'Please log in to your hosted Tlon ship using email and password.';
                  // }
                  return true;
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Field label="Ship URL" error={errors.shipUrl?.message}>
                  <TextInput
                    placeholder="https://sampel-palnet.arvo.network"
                    onBlur={() => {
                      onBlur();
                      trigger('shipUrl');
                    }}
                    onChangeText={onChange}
                    value={value}
                    autoCapitalize="none"
                    autoCorrect={false}
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
                    placeholder="xxxxxx-xxxxxx-xxxxxx-xxxxxx"
                    onBlur={() => {
                      onBlur();
                      trigger('accessCode');
                    }}
                    onChangeText={onChange}
                    value={value}
                    secureTextEntry={!codeVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    rightControls={
                      <TextInput.InnerButton
                        label={codeVisible ? 'Hide' : 'Show'}
                        onPress={() => setCodeVisible(!codeVisible)}
                      />
                    }
                  />
                </Field>
              )}
            />
          </YStack>

          <Button
            label="Connect"
            onPress={onSubmit}
            disabled={!isValid || isSubmitting}
            width="100%"
          />

          <Text fontSize="$s" color="$tertiaryText" textAlign="center">
            By logging in you agree to Tlon's Terms of Service
          </Text>
        </YStack>
      </View>
    </View>
  );
};
