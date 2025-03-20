import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View, YStack } from 'tamagui';

import { LoadingSpinner } from '../../../ui/src/components/LoadingSpinner';
import { Text } from '../../../ui/src/components/TextV2';
import { useTrackAttestConfirmation } from '../../hooks/useTrackAttestConfirmation';
import { useStore } from '../contexts';
import { AttestationPane } from './AttestationPane';
import { PrimaryButton } from './Buttons';
import { OTPInput } from './Form/OTPInput';
import { PhoneNumberInput } from './Form/PhoneNumberInput';

interface Props {
  attestation: db.Verification | null;
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

function SubmitPhoneNumPane(props: { attestation: db.Verification | null }) {
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

  const isLoading = useMemo(() => {
    return props.attestation?.status === 'pending' || isSubmitting;
  }, [isSubmitting, props.attestation?.status]);

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
      <PrimaryButton
        onPress={onSubmit}
        loading={isLoading}
        disabled={
          isSubmitting ||
          remoteError !== undefined ||
          !phoneForm.formState.isValid
        }
        marginTop="$2xl"
      >
        <Text color="$background" size="$label/l">
          Connect Phone Number
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
  const requestTracker = useTrackAttestConfirmation(props.attestation);

  const handleSubmit = useCallback(
    async (submittedOtp: string) => {
      try {
        requestTracker.startRequest();
        await store.confirmPhoneAttestation(
          props.attestation.value!,
          submittedOtp
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [props.attestation.value, requestTracker, store]
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
      <Text
        size="$label/l"
        fontWeight="600"
        marginBottom="$2xl"
        textAlign="center"
      >
        {props.attestation.value}
      </Text>
      <OTPInput
        value={otp}
        length={PHONE_CODE_LENGTH}
        onChange={handleCodeChanged}
        mode="phone"
      />
      {requestTracker.didError && (
        <Text color="$negativeActionText">Confirmation code is incorrect.</Text>
      )}
    </YStack>
  );
}

function VerifiedPhonePane(props: {
  attestation: db.Verification;
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
