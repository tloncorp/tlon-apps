import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View, XStack, YStack } from 'tamagui';

import { LoadingSpinner } from '../../../ui/src/components/LoadingSpinner';
import { Text } from '../../../ui/src/components/TextV2';
import { useStore } from '../contexts';
import { PrimaryButton } from './Buttons';
import { OTPInput } from './Form/OTPInput';
import { PhoneNumberInput } from './Form/PhoneNumberInput';

interface Props {
  attestation: db.Verification | null;
  isLoading: boolean;
  currentUserId: string;
}

type Pane = 'init' | 'confirm' | 'verified';

export function PhoneAttestationPane({ isLoading, attestation }: Props) {
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

      {pane === 'init' && <SubmitPhoneNumPane />}
      {pane === 'confirm' && attestation && (
        <ConfirmPhoneNumPane attestation={attestation} />
      )}
      {pane === 'verified' && attestation && (
        <VerifiedPhonePane attestation={attestation} />
      )}
    </View>
  );
}

type PhoneFormData = {
  phoneNumber: string;
};

function SubmitPhoneNumPane() {
  const store = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();

  const phoneForm = useForm<PhoneFormData>({
    defaultValues: {
      phoneNumber: '',
    },
  });

  const onSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await phoneForm.handleSubmit(async ({ phoneNumber }) => {
        store.initiatePhoneAttestation(phoneNumber);
      })();
    } finally {
      setIsSubmitting(false);
    }
  }, [phoneForm, store]);

  return (
    <YStack>
      <Text>Enter your phone number</Text>
      <PhoneNumberInput form={phoneForm} />
      <PrimaryButton
        onPress={onSubmit}
        loading={isSubmitting}
        disabled={
          isSubmitting ||
          remoteError !== undefined ||
          !phoneForm.formState.isValid
        }
      >
        <Text color="$background" size="$label/l">
          Sign up
        </Text>
      </PrimaryButton>
    </YStack>
  );
}

const PHONE_CODE_LENGTH = 6;
function ConfirmPhoneNumPane(props: { attestation: db.Verification }) {
  const store = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otp, setOtp] = useState<string[]>([]);

  const handleSubmit = useCallback(
    async (submittedOtp: string) => {
      try {
        await store.confirmPhoneAttestation(
          props.attestation.value,
          submittedOtp
        );
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

  return (
    <YStack>
      <Text>
        We have sent a confirmation code to your phone number. Please enter it
        below.
      </Text>
      <OTPInput
        value={otp}
        length={PHONE_CODE_LENGTH}
        onChange={handleCodeChanged}
        mode="phone"
      />
    </YStack>
  );
}

function VerifiedPhonePane(props: { attestation: db.Verification }) {
  return (
    <YStack>
      <Text>Phone number verified!</Text>
    </YStack>
  );
}
