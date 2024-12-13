import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useStore } from '../contexts';
import { ActionSheet } from './ActionSheet';
import { PrimaryButton } from './Buttons';
import { OTPInput } from './Form/OTPInput';
import { PhoneNumberInput } from './Form/PhoneNumberInput';
import { ListItem } from './ListItem';
import { LoadingSpinner } from './LoadingSpinner';
import { Text } from './TextV2';

type PhoneFormData = {
  phoneNumber: string;
};

const NUM_OTP_DIGITS = 6;

export function VerifyPhoneNumberSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verification: db.Verification | null;
  verificationLoading: boolean;
}) {
  const { verification, verificationLoading } = props;
  const store = useStore();

  const [pane, setPane] = useState<
    'init' | 'submitPhone' | 'submitOtp' | 'success'
  >('init');
  const [error, setError] = useState<string | undefined>();
  const [isPoking, setIsPoking] = useState(false);
  const [readyForOtp, setReadyForOtp] = useState(false);
  const [sentOtp, setSentOtp] = useState(false);
  const [otp, setOtp] = useState<string[]>([]);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    setPane('init');
    setError(undefined);
    setOtp([]);
    setIsPoking(false);
    setReadyForOtp(false);
    setSentOtp(false);
    props.onOpenChange(false);
  }, [props]);

  // when we open the sheet, check the verification to determine what pane to show
  useEffect(() => {
    if (props.open) {
      if (pane === 'init' && !verificationLoading) {
        if (!verification) {
          setPane('submitPhone');
          return;
        }
        if (verification.status === 'verified') {
          setPane('success');
          return;
        }

        setPane('submitOtp');
        return;
      }
    }
  }, [pane, props.open, verification, verificationLoading]);

  const phoneForm = useForm<PhoneFormData>({
    defaultValues: {
      phoneNumber: '',
    },
    reValidateMode: 'onChange',
  });

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

  const handleCodeChanged = useCallback(
    async (nextCode: string[]) => {
      setOtp(nextCode);
      if (nextCode.length === NUM_OTP_DIGITS && nextCode.every(Boolean)) {
        // do work
        console.log('submitting otp');
        await store.checkPhoneVerifyOtp(verification!.value, nextCode.join(''));
        setSentOtp(true);
      }
    },
    [store, verification]
  );

  // after we've sent the code, wait for the verification to be confirmed
  useEffect(() => {
    if (
      pane === 'submitOtp' &&
      sentOtp &&
      verification?.status === 'verified'
    ) {
      setPane('success');
      setTimeout(() => {
        handleClose();
      }, 4000);
    }
  }, [handleClose, pane, sentOtp, verification]);

  // no subscription right now, so we need to poll for verification status
  useEffect(() => {
    const shouldPoll =
      (pane === 'submitPhone' && readyForOtp) ||
      (pane === 'submitOtp' && sentOtp);
    if (shouldPoll && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        console.log('polling for verification status');
        // await store.syncVerifications();
      }, 2000);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  });

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

        {pane === 'init' && (
          <ActionSheet.Content
            flex={1}
            justifyContent="center"
            alignItems="center"
          >
            <LoadingSpinner />
          </ActionSheet.Content>
        )}

        {pane === 'submitOtp' && (
          <ActionSheet.Content>
            <ActionSheet.ContentBlock paddingTop={0}>
              <Text color="$secondaryText">
                A confirmation code was sent to{' '}
                <Text>{phoneForm.getValues().phoneNumber}</Text>
              </Text>
            </ActionSheet.ContentBlock>
            <ActionSheet.ContentBlock gap="$xl">
              <OTPInput
                length={6}
                mode="phone"
                value={otp}
                onChange={handleCodeChanged}
                label="Please enter your code below"
              />
            </ActionSheet.ContentBlock>
          </ActionSheet.Content>
        )}

        {pane === 'success' && (
          <ActionSheet.Content>
            <ActionSheet.ContentBlock paddingTop={0}>
              <ListItem backgroundColor="$greenSoft">
                <ListItem.SystemIcon
                  icon="Checkmark"
                  color="$greenSoft"
                  backgroundColor="$green"
                />
                <ListItem.MainContent>
                  <ListItem.Title color="$green">
                    Verification Complete
                  </ListItem.Title>
                </ListItem.MainContent>
              </ListItem>
            </ActionSheet.ContentBlock>
          </ActionSheet.Content>
        )}
      </ActionSheet.ContentBlock>
    </ActionSheet>
  );
}
