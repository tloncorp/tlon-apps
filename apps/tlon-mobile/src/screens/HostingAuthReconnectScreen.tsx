import type { HostingLoginOtpInfo } from '@tloncorp/api';
import { HostingError } from '@tloncorp/api';
import {
  AppDataContextProvider,
  KeyboardAvoidingView,
  LoadingSpinner,
  ScreenHeader,
  TlonText,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { Badge } from '@tloncorp/app/ui/components/Badge';
import ProfileRow from '@tloncorp/app/ui/components/ProfileRow';
import type * as db from '@tloncorp/shared/db';
import { Button } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OTPInput } from '../components/OnboardingInputs';

const OTP_LENGTH = 6;

type RequestState = 'idle' | 'requesting' | 'sent';

export type HostingAuthReconnectScreenProps = {
  profileId: string;
  profile?: db.Contact | null;
  initialOtpInfo?: HostingLoginOtpInfo;
  autoRequest?: boolean;
  onRequestCode: () => Promise<HostingLoginOtpInfo>;
  onVerifyCode: (otp: string) => Promise<void>;
  onLogout: () => void | Promise<void>;
};

export function HostingAuthReconnectScreen({
  profileId,
  profile,
  initialOtpInfo,
  autoRequest = true,
  onRequestCode,
  onVerifyCode,
  onLogout,
}: HostingAuthReconnectScreenProps) {
  const [otp, setOtp] = useState<string[]>([]);
  const [otpInfo, setOtpInfo] = useState<HostingLoginOtpInfo | null>(
    initialOtpInfo ?? null
  );
  const [requestState, setRequestState] = useState<RequestState>(
    initialOtpInfo ? 'sent' : 'idle'
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string>();
  const requestStarted = useRef(false);
  const insets = useSafeAreaInsets();

  const requestCode = useCallback(async () => {
    setRequestState('requesting');
    setError(undefined);
    setOtp([]);

    try {
      const info = await onRequestCode();
      setOtpInfo(info);
      setRequestState('sent');
    } catch (requestError) {
      if (
        requestError instanceof HostingError &&
        requestError.details.status === 429
      ) {
        // A recent request means the user should already have a usable code.
        setRequestState('sent');
        setError('A code was sent recently. Enter it below or try again soon.');
        return;
      }

      setRequestState('idle');
      setError('We could not send a confirmation code. Please try again.');
    }
  }, [onRequestCode]);

  useEffect(() => {
    if (!autoRequest || requestStarted.current) {
      return;
    }

    requestStarted.current = true;
    void requestCode();
  }, [autoRequest, requestCode]);

  const verifyCode = useCallback(
    async (code: string) => {
      setIsVerifying(true);
      setError(undefined);
      try {
        await onVerifyCode(code);
      } catch (verifyError) {
        setOtp([]);
        if (
          verifyError instanceof HostingError &&
          (verifyError.details.status === 400 ||
            verifyError.details.status === 401)
        ) {
          setError('Confirmation code is incorrect or expired.');
        } else {
          setError('We could not reconnect your account. Please try again.');
        }
        setIsVerifying(false);
        return;
      }

      setIsVerifying(false);
    },
    [onVerifyCode]
  );

  const handleCodeChanged = useCallback((nextCode: string[]) => {
    setOtp(nextCode);
    setError(undefined);
  }, []);

  const isCodeComplete =
    otp.length === OTP_LENGTH && otp.every((digit) => Boolean(digit));

  const handlePrimaryAction = useCallback(() => {
    if (requestState === 'sent' && isCodeComplete && !isVerifying) {
      void verifyCode(otp.join(''));
      return;
    }

    if (requestState === 'idle') {
      void requestCode();
    }
  }, [isCodeComplete, isVerifying, otp, requestCode, requestState, verifyCode]);

  const delivery = useMemo(() => {
    if (otpInfo?.maskedPhoneNumber) {
      return {
        method: 'phone' as const,
        destination: otpInfo.maskedPhoneNumber,
      };
    }
    if (otpInfo?.maskedEmail) {
      return {
        method: 'email' as const,
        destination: otpInfo.maskedEmail,
      };
    }
    return {
      method: 'contact' as const,
      destination: undefined,
    };
  }, [otpInfo]);

  const destination = delivery.destination?.replaceAll('*', '•');
  const primaryActionDisabled =
    requestState === 'requesting' ||
    isVerifying ||
    (requestState === 'sent' && !isCodeComplete);

  return (
    <AppDataContextProvider
      currentUserId={profileId}
      contacts={profile ? [profile] : []}
    >
      <View
        flex={1}
        backgroundColor="$background"
        testID="hosting-auth-reconnect-screen"
      >
        <ScreenHeader
          title="Security check"
          backgroundColor="$background"
          leftControls={
            <ScreenHeader.TextButton color="$secondaryText" onPress={onLogout}>
              Log out
            </ScreenHeader.TextButton>
          }
        />
        <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={120}>
          <YStack flex={1}>
            <YStack paddingTop={29} paddingHorizontal={20}>
              <ProfileRow
                contactId={profileId}
                contact={profile ?? undefined}
                compact
                outlined
                dark
                endContent={<Badge text="Signed in" type="neutral" />}
              />

              <YStack gap="$m" marginTop="$3.5xl">
                <TlonText.Text
                  size="$title/l"
                  fontSize={29}
                  color="$primaryText"
                  trimmed={false}
                >
                  Let&apos;s make sure it&apos;s you
                </TlonText.Text>
                <TlonText.Text
                  size="$label/xl"
                  color="$secondaryText"
                  trimmed={false}
                  maxWidth={340}
                >
                  Your session needs a quick refresh before you can keep going.
                  {destination ? (
                    <>
                      {' We sent a 6-digit code to '}
                      <TlonText.Text
                        size="$label/xl"
                        color="$primaryText"
                        fontWeight="500"
                        trimmed={false}
                      >
                        {destination}.
                      </TlonText.Text>
                    </>
                  ) : (
                    ' We’ll send a 6-digit code to the email or phone number on your account.'
                  )}
                </TlonText.Text>
              </YStack>

              <YStack marginTop="$3xl">
                {requestState === 'requesting' ? (
                  <YStack
                    height={126}
                    alignItems="center"
                    justifyContent="center"
                    gap="$l"
                  >
                    <LoadingSpinner />
                    <TlonText.Text size="$label/m" color="$secondaryText">
                      Sending a code…
                    </TlonText.Text>
                  </YStack>
                ) : requestState === 'sent' ? (
                  <YStack gap="$3.5xl">
                    <OTPInput
                      value={otp}
                      length={OTP_LENGTH}
                      onChange={handleCodeChanged}
                      mode={delivery.method}
                      error={error}
                      variant="prominent"
                    />
                    <Button
                      preset="minimal"
                      size="medium"
                      label="Request a new code"
                      onPress={() => void requestCode()}
                      centered
                    />
                  </YStack>
                ) : error ? (
                  <TlonText.Text
                    size="$label/m"
                    color="$negativeActionText"
                    textAlign="center"
                  >
                    {error}
                  </TlonText.Text>
                ) : null}
              </YStack>
            </YStack>

            <YStack
              marginTop="auto"
              paddingHorizontal={20}
              paddingTop="$xl"
              paddingBottom={insets.bottom + 10}
            >
              <Button
                preset="primary"
                size="medium"
                label={requestState === 'sent' ? 'Confirm code' : 'Send code'}
                loading={requestState === 'requesting' || isVerifying}
                onPress={handlePrimaryAction}
                pointerEvents={primaryActionDisabled ? 'none' : 'auto'}
                accessibilityState={{ disabled: primaryActionDisabled }}
                opacity={primaryActionDisabled ? 0.35 : 1}
                centered
                shadow
                testID="hosting-auth-reconnect-primary-action"
              />
            </YStack>
          </YStack>
        </KeyboardAvoidingView>
      </View>
    </AppDataContextProvider>
  );
}
