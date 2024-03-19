import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getLandscapeAuthCookie } from '@tloncorp/shared/dist/api/landscapeApi';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import { HeaderButton } from '../components/HeaderButton';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  ACCESS_CODE_REGEX,
  DEFAULT_SHIP_LOGIN_ACCESS_CODE,
  DEFAULT_SHIP_LOGIN_URL,
} from '../constants';
import { useShip } from '../contexts/ship';
import type { OnboardingStackParamList } from '../types';
import { isEulaAgreed } from '../utils/eula';
import { getShipFromCookie } from '../utils/ship';
import { transformShipURL } from '../utils/string';

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

  const onSubmit = handleSubmit(async ({ shipUrl: rawShipUrl, accessCode }) => {
    setIsSubmitting(true);

    const shipUrl = transformShipURL(rawShipUrl);
    setFormattedShipUrl(shipUrl);
    try {
      const authCookie = await getLandscapeAuthCookie(shipUrl, accessCode);
      if (authCookie) {
        const shipId = getShipFromCookie(authCookie);
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
        setRemoteError("Sorry, we couldn't log you into your Urbit ID.");
      }
    } catch (err) {
      setRemoteError((err as Error).message);
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
        Connect an unhosted ship by entering its URL and access code.
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
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={tailwind(
                'p-4 text-tlon-black-80 dark:text-white border border-tlon-black-20 dark:border-tlon-black-80 rounded-lg'
              )}
              placeholder="sampel-palnet.tlon.network"
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
