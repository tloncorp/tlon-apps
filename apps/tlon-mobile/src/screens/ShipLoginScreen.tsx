import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ACCESS_CODE_REGEX,
  DEFAULT_SHIP_LOGIN_ACCESS_CODE,
  DEFAULT_SHIP_LOGIN_URL,
} from '@tloncorp/app/constants';
import { useShip } from '@tloncorp/app/contexts/ship';
import { isEulaAgreed } from '@tloncorp/app/utils/eula';
import { getShipFromCookie } from '@tloncorp/app/utils/ship';
import { transformShipURL } from '@tloncorp/app/utils/string';
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
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { OnboardingStackParamList } from '../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ShipLogin'>;

type FormData = {
  shipUrl: string;
  accessCode: string;
};

export const ShipLoginScreen = ({ navigation }: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formattedShipUrl, setFormattedShipUrl] = useState<
    string | undefined
  >();
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const {
    control,
    setFocus,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormData>({
    defaultValues: {
      shipUrl: DEFAULT_SHIP_LOGIN_URL,
      accessCode: DEFAULT_SHIP_LOGIN_ACCESS_CODE,
    },
  });
  const { setShip } = useShip();

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

  const onSubmit = handleSubmit(async ({ shipUrl: rawShipUrl, accessCode }) => {
    setIsSubmitting(true);

    const shipUrl = transformShipURL(rawShipUrl);
    setFormattedShipUrl(shipUrl);
    try {
      const authCookie = await getLandscapeAuthCookie(
        shipUrl,
        accessCode.trim()
      );
      if (authCookie) {
        const shipId = getShipFromCookie(authCookie);
        if (await isEulaAgreed()) {
          setShip({
            ship: shipId,
            shipUrl,
            authCookie,
          });
        } else {
          navigation.navigate('EULA', { shipId, shipUrl, authCookie });
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
    <View flex={1}>
      <GenericHeader
        title="Connect Ship"
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
            Connect a self-hosted ship by entering its URL and access code.
          </SizableText>
          {remoteError ? (
            <SizableText color="$negativeActionText">{remoteError}</SizableText>
          ) : null}
          <View>
            <SizableText marginBottom="$m">Ship URL</SizableText>
            <Controller
              control={control}
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
                <Input height="$4xl">
                  <Input.Area
                    placeholder="https://sampel-palnet.arvo.network"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    onSubmitEditing={() => setFocus('accessCode')}
                    value={value}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    enablesReturnKeyAutomatically
                  />
                </Input>
              )}
              name="shipUrl"
            />
            {errors.shipUrl && (
              <SizableText
                color="$negativeActionText"
                marginTop="$m"
                fontSize="$s"
              >
                {errors.shipUrl.message}
              </SizableText>
            )}
          </View>
          <View>
            <SizableText marginBottom="$m">Access Code</SizableText>
            <Controller
              control={control}
              rules={{
                required: 'Please enter a valid access code.',
                pattern: {
                  value: ACCESS_CODE_REGEX,
                  message: 'Please enter a valid access code.',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input height="$4xl">
                  <Input.Area
                    placeholder="xxxxxx-xxxxxx-xxxxxx-xxxxxx"
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
              name="accessCode"
            />
            {errors.accessCode && (
              <SizableText
                color="$negativeActionText"
                marginTop="$m"
                fontSize="$s"
              >
                {errors.accessCode.message}
              </SizableText>
            )}
          </View>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
