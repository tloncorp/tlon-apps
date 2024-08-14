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
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import { HeaderButton } from '../components/HeaderButton';
import { LoadingSpinner } from '../components/LoadingSpinner';
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
  const tailwind = useTailwind();
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton title="Back" onPress={() => navigation.goBack()} />
      ),
      headerRight: () =>
        isSubmitting ? (
          <View style={tailwind('px-8')}>
            <LoadingSpinner height={16} />
          </View>
        ) : (
          <HeaderButton title="Connect" onPress={onSubmit} isSubmit />
        ),
    });
  }, [navigation, isSubmitting, tailwind, onSubmit]);

  useEffect(() => {
    if (errors.shipUrl && formattedShipUrl) {
      setFocus('shipUrl');
      setValue('shipUrl', formattedShipUrl);
    }
  }, [errors.shipUrl, formattedShipUrl, setFocus, setValue]);

  return (
    <View style={tailwind('p-6 h-full bg-white dark:bg-black')}>
      <Text
        style={tailwind(
          'text-lg font-medium text-tlon-black-80 dark:text-white'
        )}
      >
        Connect a self-hosted ship by entering its URL and access code.
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
          Ship URL
        </Text>
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
            <TextInput
              testID="textInput shipUrl"
              style={tailwind(
                'p-4 text-tlon-black-80 dark:text-white border border-tlon-black-20 dark:border-tlon-black-80 rounded-lg'
              )}
              placeholder="https://sampel-palnet.arvo.network"
              placeholderTextColor="#999999"
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
          )}
          name="shipUrl"
        />
        {errors.shipUrl ? (
          <Text style={tailwind('mt-2 text-tlon-red')}>
            {errors.shipUrl.message}
          </Text>
        ) : null}
      </View>
      <View style={tailwind('mt-8')}>
        <Text
          style={tailwind(
            'mb-2 text-lg font-medium text-tlon-black-80 dark:text-white'
          )}
        >
          Access Code
        </Text>
        <Controller
          control={control}
          rules={{
            required: 'Please enter a valid access code.',
            pattern: {
              value: ACCESS_CODE_REGEX,
              message: 'Please enter a valid access code.',
            },
          }}
          render={({ field: { ref, onChange, onBlur, value } }) => (
            <TextInput
              ref={ref}
              testID="textInput accessCode"
              style={tailwind(
                'p-4 text-tlon-black-80 dark:text-white border border-tlon-black-20 dark:border-tlon-black-80 rounded-lg'
              )}
              placeholder="xxxxxx-xxxxxx-xxxxxx-xxxxxx"
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
          name="accessCode"
        />
        {errors.accessCode ? (
          <Text style={tailwind('mt-2 text-tlon-red')}>
            {errors.accessCode.message}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
