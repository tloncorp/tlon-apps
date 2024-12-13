import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useStore } from '../contexts';
import { ActionSheet } from './ActionSheet';
import { PrimaryButton } from './Buttons';
import { OTPInput } from './Form/OTPInput';
import { PhoneNumberInput } from './Form/PhoneNumberInput';
import { Text } from './TextV2';

type PhoneFormData = {
  phoneNumber: string;
};

const NUM_OTP_DIGITS = 6;

export function VerifyPhoneNumberSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = useStore();
  const { data: verifications } = store.useVerifications();

  // for now, assume you only ever have one phone verification
  const verification = useMemo(
    () => verifications?.find((v) => v.type === 'phone'),
    [verifications]
  );

  const [pane, setPane] = useState<'submitPhone' | 'submitOtp' | 'success'>(
    'submitPhone'
  );
  const [error, setError] = useState<string | undefined>();
  const [isPoking, setIsPoking] = useState(false);
  const [readyForOtp, setReadyForOtp] = useState(false);
  const [otp, setOtp] = useState<string[]>([]);

  const phoneForm = useForm<PhoneFormData>({
    defaultValues: {
      phoneNumber: '',
    },
  });

  //
  const handleSubmitPhoneNumber = useCallback(async () => {
    console.log('handleSubmitPhoneNumber');
    setIsPoking(true);
    try {
      phoneForm.handleSubmit(async ({ phoneNumber }) => {
        // send verify
        console.log('sending verification code', phoneForm.getValues());
        await store.startPhoneVerify(phoneNumber);
        setReadyForOtp(true);
      })();
    } catch (e) {
      console.error(e);
      setError('Something went wrong, please try again');
    } finally {
      setIsPoking(false);
    }
  }, [phoneForm, store]);

  useEffect(() => {
    // once phone # is submitted, wait for backend
    // to confirm otp was sent ('pending' status) before
    // transitioning panes
    if (
      pane === 'submitPhone' &&
      readyForOtp &&
      verification?.status === 'pending'
    ) {
      setPane('submitOtp');
    }
  }, [pane, readyForOtp, verification]);

  const handleCodeChanged = useCallback((nextCode: string[]) => {
    setOtp(nextCode);
    if (nextCode.length === NUM_OTP_DIGITS && nextCode.every(Boolean)) {
      // do work
      console.log('submitting otp');
    }
  }, []);

  const handleClose = useCallback(() => {
    setPane('submitPhone');
    setOtp([]);
    setError(undefined);
    setIsPoking(false);
    setReadyForOtp(false);
    props.onOpenChange(false);
  }, [props]);

  return (
    <ActionSheet
      open={props.open}
      onOpenChange={handleClose}
      snapPointsMode="percent"
      snapPoints={[80]}
    >
      <ActionSheet.SimpleHeader title="Verify Phone Number" />
      <ActionSheet.ContentBlock>
        {pane === 'submitPhone' && (
          <ActionSheet.Content>
            <ActionSheet.ContentBlock paddingTop={0}>
              <Text color="$secondaryText">
                Verifying your phone number lets anyone who has you in their
                phone book look you up on the network. Your phone number will
                not be publically visible.
              </Text>
            </ActionSheet.ContentBlock>
            <ActionSheet.ContentBlock gap="$xl">
              <PhoneNumberInput form={phoneForm} />
              <PrimaryButton
                disabled={!phoneForm.formState.isValid || isPoking}
                loading={isPoking || readyForOtp}
                onPress={handleSubmitPhoneNumber}
              >
                Send verification code
              </PrimaryButton>
            </ActionSheet.ContentBlock>
          </ActionSheet.Content>
        )}

        {pane === 'submitOtp' && (
          <ActionSheet.Content>
            <ActionSheet.ContentBlock paddingTop={0}>
              <Text color="$secondaryText">
                A verification code was sent to $
                {phoneForm.getValues().phoneNumber}. Please enter it below.
              </Text>
            </ActionSheet.ContentBlock>
            <ActionSheet.ContentBlock gap="$xl">
              <OTPInput
                length={6}
                mode="phone"
                value={otp}
                onChange={handleCodeChanged}
              />
            </ActionSheet.ContentBlock>
          </ActionSheet.Content>
        )}

        {pane === 'success' && (
          <ActionSheet.Content>
            <ActionSheet.ContentBlock paddingTop={0}>
              <Text color="$green">Your phone number has been verified.</Text>
            </ActionSheet.ContentBlock>
          </ActionSheet.Content>
        )}
      </ActionSheet.ContentBlock>
    </ActionSheet>
  );
}
