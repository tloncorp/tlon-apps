import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View, YStack } from 'tamagui';

import { Button } from '../../../ui/src/components/Button';
import { LoadingSpinner } from '../../../ui/src/components/LoadingSpinner';
import { Text } from '../../../ui/src/components/TextV2';
import { useStore } from '../contexts';
import { ControlledTextField } from './Form';
import { WidgetPane } from './WidgetPane';

interface Props {
  attestationType: 'twitter' | 'phone';
  attestation: db.Verification | null;
  isLoading: boolean;
  currentUserId: string;
}

type Pane = 'init' | 'confirm' | 'verified';

export function AttestationScreenView({
  isLoading,
  attestation,
  currentUserId,
}: Props) {
  const store = useStore();
  const [pane, setPane] = useState<Pane>('init');

  useEffect(() => {
    if (attestation) {
      if (attestation.status === 'pending' && pane !== 'confirm') {
        setPane('confirm');
      }

      if (attestation.status === 'verified' && pane !== 'verified') {
        setPane('verified');
      }
    } else {
      setPane('init');
    }
  }, [attestation, pane]);

  return (
    <View flex={1} marginHorizontal="$2xl" marginTop="$l">
      {/* <Button onPress={() => store.syncVerifications()}>
        <Button.Text>Sync Verifications</Button.Text>
      </Button> */}
      {isLoading && (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <LoadingSpinner />
        </YStack>
      )}

      {pane === 'init' && <InitiateTwitterPane />}
      {pane === 'confirm' && attestation && (
        <ConfirmTwitterPane attestation={attestation} />
      )}
    </View>
  );
}

function ConfirmTwitterPane(props: { attestation: db.Verification }) {
  useEffect(() => {
    async function runEffect() {
      console.log(`bl: confirming twitter`);
      const result = await api.fetchTwitterConfirmPayload(
        props.attestation.value
      );
      console.log('got result', result);
    }
    runEffect();
  }, [props.attestation]);

  const store = useStore();
  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      twitterPostId: '',
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    console.log(`bl: submitting handle`, data.twitterPostId);
    await api.confirmTwitterAttestation(
      props.attestation.value,
      data.twitterPostId
    );
  });

  return (
    <View>
      <Text size="$label/m">
        To complete verification, send this post from your 𝕏 account.
      </Text>
      <WidgetPane backgroundColor="$secondaryBackground">
        <Text size="$label/m" color="$secondaryText">
          {`Verifying myself as ~latter-bolden on Tlon
          68Ae4jVYjf7CWUJXTwQ6ClPWFtlNAKW4TP9mKRkPm6Bez80l5epf0ewsigXn80UMsj26cnHOcjvBuiUbuEaNv~A0eXZvvY41QsSlQrCZItfM3f9Bt7hFtTiY0KcIduxs~xv5D0g1`}
        </Text>
      </WidgetPane>
      <ControlledTextField
        name="twitterPostId"
        label="𝕏 Post URL"
        control={control}
        inputProps={{
          placeholder: '@RyuichiSakamoto',
        }}
        rules={{
          maxLength: {
            value: 50,
            message: 'Your status is limited to 50 characters',
          },
        }}
      />
      <Button hero onPress={onSubmit} disabled={!isDirty || !isValid}>
        <Button.Text>Submit</Button.Text>
      </Button>
    </View>
  );
}

function InitiateTwitterPane() {
  const store = useStore();
  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      twitterHandle: '',
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    console.log(`bl: submitting handle`, data.twitterHandle);
    await store.initiateTwitterAttestation(data.twitterHandle);
  });

  return (
    <YStack gap="$2xl">
      <Text size="$label/m">
        You can verify an 𝕏 account and it will be displayed on your Tlon
        profile. Enter your handle to get started.
      </Text>
      <ControlledTextField
        name="twitterHandle"
        label="Handle"
        control={control}
        inputProps={{
          placeholder: '@TlonCorporation',
        }}
        rules={{
          maxLength: {
            value: 15,
            message: '𝕏 usernames are 15 characters at most',
          },
        }}
      />
      <Button hero onPress={onSubmit} disabled={!isDirty || !isValid}>
        <Button.Text>Submit</Button.Text>
      </Button>
    </YStack>
  );
}

function VerifiedTwitterPane(props: { attestation: db.Verification }) {
  return (
    <YStack gap="$2xl">
      <Text size="$label/m">Your 𝕏 account has been verified.</Text>
    </YStack>
  );
}
