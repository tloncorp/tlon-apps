import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View, YStack } from 'tamagui';

import { Text } from '../components/TextV2';
import { useStore } from '../contexts';
import { Button } from './Button';
import { ControlledTextField } from './Form';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  attestationType: 'twitter' | 'phone';
  attestation: db.Verification | null;
  isLoading: boolean;
}

type Pane = 'init' | 'confirm' | 'verified';

export function AttestationScreenView({ isLoading, attestation }: Props) {
  const store = useStore();
  const [pane, setPane] = useState<Pane>('init');

  useEffect(() => {
    if (attestation) {
      if (attestation.status === 'pending' && pane !== 'confirm') {
        setPane('confirm');
      }
    } else {
      setPane('init');
    }
  }, [attestation, pane]);

  return (
    <View flex={1} backgroundColor="orange">
      <Button onPress={() => store.syncVerifications()}>
        <Button.Text>Sync Verifications</Button.Text>
      </Button>
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
      <Text>Which post u do?</Text>
      <ControlledTextField
        name="twitterPostId"
        label="Handle"
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
    <View>
      <Text>Verify an X Account</Text>
      <ControlledTextField
        name="twitterHandle"
        label="Handle"
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
