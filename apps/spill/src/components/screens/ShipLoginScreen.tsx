import * as api from '@api';
import * as db from '@db';
import {Button, Text, TextInput, YStack} from '@ochre';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Controller, useForm} from 'react-hook-form';
import {KeyboardAvoidingView, Platform} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type FormData = {
  shipUrl: string;
  accessCode: string;
};

const urlControllerRules = {
  required: 'Please enter a valid URL.',
};

const accessCodeControllerRules = {
  required: 'Please enter an access code.',
};

export const ShipLoginScreen = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formattedShipUrl, setFormattedShipUrl] = useState<
    string | undefined
  >();
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const {
    control,
    setFocus,
    handleSubmit,
    formState: {errors},
    setValue,
  } = useForm<FormData>();
  const queries = db.useOps();

  const onSubmit = handleSubmit(async ({shipUrl, accessCode}) => {
    setIsSubmitting(true);

    const shipUrlToUse = api.normalizeShipUrl(shipUrl);

    setFormattedShipUrl(shipUrlToUse);

    try {
      await api.authenticateWithCode(
        {
          shipUrl: shipUrlToUse,
          accessCode,
        },
        credentials => {
          queries.createOrUpdateAccount({
            id: db.DEFAULT_ACCOUNT_ID,
            ship: credentials.ship,
            url: credentials.url,
            cookie: credentials.cookie,
          });
          setIsSubmitting(false);
        },
      );
    } catch (err) {
      console.log('Error!', err);
      setRemoteError((err as Error).message);
    }
  });

  useEffect(() => {
    if (errors.shipUrl && formattedShipUrl) {
      setFocus('shipUrl');
      setValue('shipUrl', formattedShipUrl);
    }
  }, [errors.shipUrl, formattedShipUrl, setFocus, setValue]);

  const handleSubmitUrl = useCallback(() => {
    setFocus('accessCode');
  }, [setFocus]);

  const insets = useSafeAreaInsets();
  const keyboardAvoidingViewStyle = useMemo(() => ({flex: 1}), []);

  return (
    <KeyboardAvoidingView
      style={keyboardAvoidingViewStyle}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <YStack
        justifyContent="center"
        alignItems="stretch"
        flex={1}
        gap="$m"
        paddingTop={insets.top}
        paddingHorizontal="$l"
        width={'100%'}>
        {remoteError ? <Text>{remoteError}</Text> : null}
        <YStack gap="$xs">
          <Text>Ship URL</Text>
          <Controller
            name="shipUrl"
            control={control}
            rules={urlControllerRules}
            render={({field: {onChange, ...field}}) => (
              <TextInput
                {...field}
                onChangeText={onChange}
                placeholder="sampel-palnet.tlon.network"
                onSubmitEditing={handleSubmitUrl}
                textContentType="oneTimeCode"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                enablesReturnKeyAutomatically
              />
            )}
          />
          {errors.shipUrl ? <Text>{errors.shipUrl.message}</Text> : null}
        </YStack>
        <YStack gap="$xs">
          <Text>Access Code</Text>
          <Controller
            name="accessCode"
            control={control}
            rules={accessCodeControllerRules}
            render={({field: {onChange, ...field}}) => (
              <TextInput
                {...field}
                onChangeText={onChange}
                placeholder="xxxxxx-xxxxxx-xxxxxx-xxxxxx"
                onSubmitEditing={onSubmit}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                enablesReturnKeyAutomatically
              />
            )}
          />
          {errors.accessCode ? <Text>{errors.accessCode.message}</Text> : null}
        </YStack>
        <Button
          onPress={onSubmit}
          disabled={isSubmitting}
          justifyContent="center"
          height={'$xl'}>
          <Button.Text textAlign="center">
            {isSubmitting ? 'Connecting...' : 'Connect'}
          </Button.Text>
        </Button>
      </YStack>
    </KeyboardAvoidingView>
  );
};
