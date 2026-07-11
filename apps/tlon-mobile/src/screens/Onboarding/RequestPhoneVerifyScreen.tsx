import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  OnboardingTextBlock,
  ScreenHeader,
  TlonText,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { createDevLogger } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { PhoneNumberInput } from '../../components/OnboardingInputs';
import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'RequestPhoneVerify'
>;

type FormData = {
  phoneNumber: string;
};

const logger = createDevLogger('RequestPhoneVerifyScreen', true);

export const RequestPhoneVerifyScreen = ({
  navigation,
  route: { params },
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();

  const form = useForm<FormData>();
  const { handleSubmit } = form;

  const onSubmit = handleSubmit(async ({ phoneNumber }) => {
    setIsSubmitting(true);
    try {
      await store.requestPhoneVerify(phoneNumber);
      trackOnboardingAction({
        actionName: 'Phone Verification Requested',
      });
      navigation.navigate('CheckVerify', { phoneNumber, mode: params.mode });
    } catch (err) {
      console.error('Error verifiying phone number:', err);
      if (err instanceof SyntaxError) {
        setRemoteError('Invalid phone number, please contact support@tlon.io');
        logger.trackError('Invalid Phone Number', err);
      } else if (err instanceof Error) {
        setRemoteError(err.message);
        logger.trackError('Error Submitting Phone Verification', err);
      }
    }

    setIsSubmitting(false);
  });

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Confirm"
        loadingSubtitle={isSubmitting ? 'Loading…' : null}
        backgroundColor="$secondaryBackground"
        backAction={() => navigation.goBack()}
        rightControls={
          <ScreenHeader.TextButton onPress={onSubmit} disabled={isSubmitting}>
            Next
          </ScreenHeader.TextButton>
        }
      />
      <YStack gap="$m" paddingHorizontal="$2xl">
        <OnboardingTextBlock>
          <TlonText.Text size="$body" color="$primaryText">
            Tlon is a platform for humans. We want to make sure you&rsquo;re one
            too. We&rsquo;ll send you a verification code to the phone number
            you enter below.
          </TlonText.Text>
          {remoteError ? (
            <TlonText.Text color="$negativeActionText" fontSize="$s">
              {remoteError}
            </TlonText.Text>
          ) : null}
        </OnboardingTextBlock>

        <View
          display="flex"
          flexDirection="row"
          alignItems="center"
          gap="$m"
          paddingTop="$m"
        >
          <PhoneNumberInput form={form} shouldFocus={false} />
        </View>
      </YStack>
    </View>
  );
};
