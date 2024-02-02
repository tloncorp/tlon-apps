import * as api from '@api';
import * as db from '@db';
import {Button, Input, Text, YStack} from '@ochre';
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
    console.log('Handle submit');
    setIsSubmitting(true);

    const ship = api.getShipFromUrl(shipUrl) ?? '';
    const shipUrlToUse = api.normalizeShipUrl(shipUrl);
    console.log('Ship', ship, shipUrl, accessCode);

    setFormattedShipUrl(shipUrlToUse);

    try {
      await api.init({
        ship,
        shipUrl: shipUrlToUse,
        accessCode,
      });
    } catch (err) {
      console.log('Error!', err);
      setRemoteError((err as Error).message);
    }

    queries.createOrUpdateAccount({
      id: db.DEFAULT_ACCOUNT_ID,
      ship,
      url: shipUrlToUse,
      cookie: api.getCookie(),
    });

    setIsSubmitting(false);
    console.log('done submit');
  });

  console.log('Errors', errors);

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
            control={control}
            rules={urlControllerRules}
            render={({field: {onChange, onBlur, value, ref}}) => (
              <Input
                height="$l"
                placeholder="sampel-palnet.tlon.network"
                placeholderTextColor="#999999"
                onBlur={onBlur}
                onChangeText={onChange}
                onSubmitEditing={handleSubmitUrl}
                value={value}
                textContentType="oneTimeCode"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                enablesReturnKeyAutomatically
                ref={ref}
              />
            )}
            name="shipUrl"
          />
          {errors.shipUrl ? <Text>{errors.shipUrl.message}</Text> : null}
        </YStack>
        <YStack gap="$xs">
          <Text>Access Code</Text>
          <Controller
            control={control}
            rules={accessCodeControllerRules}
            render={({field: {onChange, onBlur, value, ref}}) => (
              <Input
                ref={ref}
                placeholder="xxxxxx-xxxxxx-xxxxxx-xxxxxx"
                placeholderTextColor="$tertiaryText"
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
          {errors.accessCode ? <Text>{errors.accessCode.message}</Text> : null}
        </YStack>
        <Button
          onPress={onSubmit}
          disabled={isSubmitting}
          justifyContent="center">
          <Button.Text textAlign="center">
            {isSubmitting ? 'Connecting...' : 'Connect'}
          </Button.Text>
        </Button>
      </YStack>
    </KeyboardAvoidingView>
  );
};
