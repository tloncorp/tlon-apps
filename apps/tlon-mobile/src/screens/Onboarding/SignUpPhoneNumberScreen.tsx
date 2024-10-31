import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEFAULT_ONBOARDING_PHONE_NUMBER } from '@tloncorp/app/constants';
import {
  useLureMetadata,
  useSignupParams,
} from '@tloncorp/app/contexts/branch';
import { trackError, trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  KeyboardAvoidingView,
  OnboardingInviteBlock,
  ScreenHeader,
  TlonText,
  View,
  YStack,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';

import { PhoneNumberInput } from '../../components/OnboardingInputs';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { useOnboardingContext } from '../../lib/OnboardingContext';
import type { OnboardingStackParamList } from '../../types';
import { useSignupContext } from '.././../lib/signupContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SignUpEmail'>;

type FormData = {
  phoneNumber: string;
};

export const SignUpPhoneNumberScreen = ({ navigation }: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const { hostingApi } = useOnboardingContext();

  const signupParams = useSignupParams();
  const signupContext = useSignupContext();
  const lureMeta = useLureMetadata();
  const recaptcha = useRecaptcha();

  const handlePressEmailSignup = useCallback(() => {
    navigation.navigate('SignUpEmail');
  }, [navigation]);

  const phoneForm = useForm<FormData>({
    defaultValues: {
      phoneNumber: DEFAULT_ONBOARDING_PHONE_NUMBER ?? '',
    },
  });

  const onSubmit = phoneForm.handleSubmit(async ({ phoneNumber }) => {
    setIsSubmitting(true);
    try {
      const recaptchaToken = await recaptcha.getToken();
      if (!recaptchaToken) {
        setRemoteError(
          `We're having trouble confirming you're human. (reCAPTCHA)`
        );
        return;
      }
      await hostingApi.requestPhoneSignupOtp({ phoneNumber, recaptchaToken });
      trackOnboardingAction({
        actionName: 'Phone Number Submitted',
        phoneNumber,
        lure: signupParams.lureId,
      });
      signupContext.setOnboardingValues({ phoneNumber });
      navigation.navigate('CheckOTP', {
        mode: 'signup',
        otpMethod: 'phone',
        phoneNumber,
      });
    } catch (err) {
      console.error('Error verifiying phone number:', err);
      if (err instanceof SyntaxError) {
        setRemoteError('Invalid phone number, please contact support@tlon.io');
        trackError({ message: 'Invalid phone number' });
      } else if (err instanceof Error) {
        setRemoteError(err.message);
        trackError(err);
      }
    }

    setIsSubmitting(false);
  });

  const goBack = useCallback(() => {
    signupContext.clear();
    navigation.goBack();
  }, [navigation, signupContext]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Accept invite"
        showSessionStatus={false}
        backAction={goBack}
        isLoading={isSubmitting}
        rightControls={
          <ScreenHeader.TextButton onPress={onSubmit} disabled={isSubmitting}>
            Next
          </ScreenHeader.TextButton>
        }
      />
      <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={180}>
        <YStack gap="$2xl" paddingHorizontal="$2xl" paddingVertical="$l">
          {lureMeta ? <OnboardingInviteBlock metadata={lureMeta} /> : null}
          <View
            display="flex"
            flexDirection="row"
            alignItems="center"
            gap="$m"
            paddingTop="$m"
          >
            <PhoneNumberInput form={phoneForm} />
          </View>
          <View marginLeft="$l">
            <TlonText.Text size="$label/s" color="$tertiaryText">
              Or if you&apos;d prefer,{' '}
              <TlonText.RawText
                pressStyle={{
                  opacity: 0.5,
                }}
                textDecorationLine="underline"
                textDecorationDistance={10}
                onPress={handlePressEmailSignup}
              >
                sign up with email
              </TlonText.RawText>
            </TlonText.Text>
          </View>
        </YStack>
      </KeyboardAvoidingView>
    </View>
  );
};
