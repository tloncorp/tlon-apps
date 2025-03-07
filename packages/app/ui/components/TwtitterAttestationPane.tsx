import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View, YStack } from 'tamagui';

import { Button } from '../../../ui/src/components/Button';
import { LoadingSpinner } from '../../../ui/src/components/LoadingSpinner';
import { Text } from '../../../ui/src/components/TextV2';
import { useStore } from '../contexts';
import { CopyableTextBlock } from './CopyableTextBlock';
import { ControlledTextField } from './Form';

interface Props {
  attestation: db.Verification | null;
  isLoading: boolean;
  currentUserId: string;
}

type Pane = 'init' | 'confirm' | 'verified';

export function TwitterAttestationPane({
  isLoading,
  attestation,
  currentUserId,
}: Props) {
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
      {isLoading && (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <LoadingSpinner />
        </YStack>
      )}

      {pane === 'init' && <InitiateTwitterPane />}
      {pane === 'confirm' && attestation && (
        <ConfirmTwitterPane
          attestation={attestation}
          currentUserId={currentUserId}
        />
      )}
      {pane === 'verified' && attestation && (
        <VerifiedTwitterPane attestation={attestation} />
      )}
    </View>
  );
}

function ConfirmTwitterPane(props: {
  attestation: db.Verification;
  currentUserId: string;
}) {
  const store = useStore();
  const [proof, setProof] = useState<string | null>(null);
  useEffect(() => {
    async function runEffect() {
      console.log(`bl: confirming twitter`);
      const result = await api.fetchTwitterConfirmPayload(
        props.attestation.value
      );
      console.log('got result', result);
      setProof(result.payload);
    }
    runEffect();
  }, [props.attestation]);
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
    await store.confirmTwitterAttestation(
      props.attestation.value,
      data.twitterPostId
    );
  });

  const tweetContent = useMemo(() => {
    return `Verifying myself as ${props.currentUserId} on Tlon

${proof}`;
  }, [proof, props.currentUserId]);

  const normalizedHandle = useMemo(
    () => props.attestation.value.replace('@', ''),
    [props.attestation.value]
  );

  return (
    <YStack gap="$2xl">
      <Text size="$label/m">
        To complete verification, send this post from your 𝕏 account.
      </Text>
      <CopyableTextBlock text={tweetContent} />
      <ControlledTextField
        name="twitterPostId"
        label="Attesting Post"
        control={control}
        inputProps={{
          placeholder: `https://x.com/${normalizedHandle}/status/1889766709566844930`,
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
    </YStack>
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
          spellCheck: false,
          autoComplete: 'off',
          autoCorrect: false,
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
