import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import { Button, LoadingSpinner, Text, triggerHaptic } from '@tloncorp/ui';
import * as LibPhone from 'libphonenumber-js';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View, YStack } from 'tamagui';

import { useStore } from '../contexts';
import { AttestationPane } from './AttestationPane';
import { OTPInput } from './Form/OTPInput';
import { PhoneNumberInput } from './Form/PhoneNumberInput';

interface Props {
  attestation: db.Attestation | null;
  isLoading: boolean;
  currentUserId: string;
}

type Pane = 'init' | 'confirm' | 'verified';

export function PhoneAttestationPane({
  isLoading,
  attestation,
  currentUserId,
}: Props) {
  const [pane, setPane] = useState<Pane>('init');

  useEffect(() => {
    if (attestation) {
      if (attestation.status === 'pending' && pane !== 'confirm') {
        triggerHaptic('baseButtonClick');
        setPane('confirm');
      }

      if (attestation.status === 'verified' && pane !== 'verified') {
        triggerHaptic('success');
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

      {pane === 'init' && <SubmitPhoneNumPane attestation={attestation} />}
      {pane === 'confirm' && attestation && (
        <ConfirmPhoneNumPane attestation={attestation} />
      )}
      {pane === 'verified' && attestation && (
        <VerifiedPhonePane
          attestation={attestation}
          currentUserId={currentUserId}
        />
      )}
    </View>
  );
}

type PhoneFormData = {
  phoneNumber: string;
};

function SubmitPhoneNumPane(props: { attestation: db.Attestation | null }) {
  const store = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();

  const phoneForm = useForm<PhoneFormData>({
    defaultValues: {
      phoneNumber: '',
    },
  });

  const onSubmit = useCallback(async () => {
    try {
      setIsSubmitting(true);
      setRemoteError(undefined);
      await phoneForm.handleSubmit(async ({ phoneNumber }) => {
        const parsedPhone = LibPhone.parsePhoneNumberFromString(phoneNumber);
        if (!parsedPhone) {
          setRemoteError('Please enter a valid phone number.');
          return;
        }
        const normalizedPhone = parsedPhone.format('E.164');
        await store.initiatePhoneAttestation(normalizedPhone);
      })();
    } catch (e) {
      if (e instanceof api.LanyardError) {
        if (e.errorCode === api.LanyardErrorCode.ALREADY_REGISTERED) {
          setRemoteError('This phone number has already been registered.');
          return;
        }
      }
      setRemoteError('Something went wrong, please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [phoneForm, store]);

  return (
    <YStack gap="$2xl">
      <YStack gap="$l">
        <Text color="$secondaryText" size="$label/m">
          Who can discover my phone number?
        </Text>
        <Text size="$label/m">
          Only friends who already have your phone number will be able to find
          you on Tlon.
        </Text>
      </YStack>
      <YStack gap="$l" marginBottom="$xl">
        <Text color="$secondaryText" size="$label/m">
          What will be displayed on my profile?
        </Text>
        <Text size="$label/m">
          Your Tlon profile will show a verified badge, but your phone number
          itself will not be revealed.
        </Text>
      </YStack>
      <PhoneNumberInput form={phoneForm} />
      <Text size="$label/s" color="$negativeActionText">
        {remoteError}
      </Text>
      <Button
        onPress={onSubmit}
        loading={isSubmitting}
        disabled={isSubmitting || !phoneForm.formState.isValid}
        marginTop="$2xl"
        label="Connect Phone Number"
        centered
      />
    </YStack>
  );
}

const PHONE_CODE_LENGTH = 6;
function ConfirmPhoneNumPane(props: { attestation: db.Attestation }) {
  const store = useStore();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otp, setOtp] = useState<string[]>([]);

  const handleSubmit = useCallback(
    async (submittedOtp: string) => {
      try {
        setIsSubmitting(true);
        setError(null);
        await store.confirmPhoneAttestation(
          props.attestation.value!,
          submittedOtp
        );
      } catch (e) {
        if (e instanceof api.LanyardError) {
          if (e.errorCode === api.LanyardErrorCode.PHONE_BAD_OTP) {
            setError('Incorrect code, please try again.');
            return;
          }
        }
        setError('Something went wrong, please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [props.attestation.value, store]
  );

  const handleCodeChanged = useCallback(
    (nextCode: string[]) => {
      setOtp(nextCode);
      if (nextCode.length === PHONE_CODE_LENGTH && nextCode.every(Boolean)) {
        handleSubmit(nextCode.join(''));
      }
    },
    [handleSubmit]
  );

  const handleRevoke = useCallback(() => {
    store.revokeAttestation(props.attestation);
  }, [props.attestation, store]);

  return (
    <YStack>
      <Text
        size="$label/l"
        fontWeight="600"
        marginBottom="$2xl"
        textAlign="center"
      >
        {domain.displayablePhoneNumber(props.attestation.value!)}
      </Text>
      <OTPInput
        value={otp}
        length={PHONE_CODE_LENGTH}
        onChange={handleCodeChanged}
        mode="phone"
      />

      <YStack marginTop="$2xl" justifyContent="center" alignItems="center">
        {isSubmitting && <LoadingSpinner />}
        {error && (
          <Text size="$label/s" color="$negativeActionText">
            {error}
          </Text>
        )}
        <Button
          fill="text"
          type="primary"
          size="small"
          centered
          label="Wrong phone number?"
          onPress={handleRevoke}
        />
      </YStack>
    </YStack>
  );
}

function VerifiedPhonePane(props: {
  attestation: db.Attestation;
  currentUserId: string;
}) {
  return (
    <YStack gap="$2xl">
      <AttestationPane
        attestation={props.attestation}
        currentUserId={props.currentUserId}
      />
    </YStack>
  );
}
