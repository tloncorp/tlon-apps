import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ACCESS_CODE_REGEX,
  DEFAULT_SHIP_LOGIN_ACCESS_CODE,
  DEFAULT_SHIP_LOGIN_URL,
} from '@tloncorp/app/constants';
import { useShip } from '@tloncorp/app/contexts/ship';
import { isEulaAgreed, setEulaAgreed } from '@tloncorp/app/utils/eula';
import { getShipFromCookie } from '@tloncorp/app/utils/ship';
import { transformShipURL } from '@tloncorp/app/utils/string';
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
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ShipLogin'>;

type FormData = {
  shipUrl: string;
  accessCode: string;
  eulaAgreed: boolean;
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
    formState: { errors, isValid },
    setValue,
    trigger,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      shipUrl: DEFAULT_SHIP_LOGIN_URL,
      accessCode: DEFAULT_SHIP_LOGIN_ACCESS_CODE,
      eulaAgreed: false,
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

  const handleEula = () => {
    navigation.navigate('EULA');
  };

  const onSubmit = handleSubmit(async (params) => {
    const { shipUrl: rawShipUrl, accessCode } = params;
    setIsSubmitting(true);

    if (params.eulaAgreed) {
      await setEulaAgreed();
    }

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
            authType: 'self',
          });
        } else {
          setRemoteError(
            'Please agree to the End User License Agreement to continue.'
          );
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
      <ScreenHeader
        title="Connect Ship"
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
            Connect a self-hosted ship by entering its URL and access code.
          </SizableText>
          {remoteError ? (
            <SizableText color="$negativeActionText">{remoteError}</SizableText>
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
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  enablesReturnKeyAutomatically
                />
              </Field>
            )}
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
          <ListItem onPress={handleEula}>
            <ListItem.MainContent>
              <ListItem.Title>End User License Agreement</ListItem.Title>
            </ListItem.MainContent>
            <ListItem.EndContent>
              <Icon type="ChevronRight" color="$primaryText" />
            </ListItem.EndContent>
          </ListItem>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
