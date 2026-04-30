import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEFAULT_INVITE_LINK_URL } from '@tloncorp/app/constants';
import { useBranch, useLureMetadata } from '@tloncorp/app/contexts/branch';
import { useTelemetryId } from '@tloncorp/app/hooks/useTelemetry';
import {
  Field,
  KeyboardAvoidingView,
  LoadingSpinner,
  ScreenHeader,
  SplashParagraph,
  SplashTitle,
  TextInput,
  View,
  XStack,
  YStack,
} from '@tloncorp/app/ui';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { checkInputForInvite, createDevLogger } from '@tloncorp/shared';
import { Button, Text } from '@tloncorp/ui';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OnboardingStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'PasteInviteLink'
>;

type FormData = {
  inviteLink: string;
};

const logger = createDevLogger('PasteInviteLinkScreen', true);

export const PasteInviteLinkScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const telemetryId = useTelemetryId();
  const lureMeta = useLureMetadata();
  const { setLure } = useBranch();
  const [checkingInput, setCheckingInput] = useState(false);

  const {
    control,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      inviteLink: DEFAULT_INVITE_LINK_URL,
    },
  });

  const [metadataError, setMetadataError] = useState<string | null>(null);

  const timedInputError = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = useCallback(
    async (input: string) => {
      setMetadataError(null);
      if (timedInputError.current) {
        clearTimeout(timedInputError.current);
      }
      timedInputError.current = null;
      try {
        if (input.length > 4) {
          setCheckingInput(true);
        }
        const appInvite = await checkInputForInvite(input, {
          telemetryId: telemetryId(),
        });
        if (appInvite) {
          setLure(appInvite);
          return;
        } else {
          if (input.length > 4) {
            timedInputError.current = setTimeout(() => {
              setMetadataError('No invite found');
            }, 500);
          }
        }
      } catch (e) {
        setMetadataError('Unable to check invite');
      } finally {
        setCheckingInput(false);
      }
    },
    [setLure, telemetryId]
  );

  const debouncedInputHandler = useMemo(
    () => debounce(handleInputChange, 300),
    [handleInputChange]
  );

  const inviteLinkValue = watch('inviteLink');
  useEffect(() => {
    debouncedInputHandler(inviteLinkValue);
  }, [inviteLinkValue, debouncedInputHandler]);

  useEffect(() => {
    if (lureMeta) {
      trackOnboardingAction({
        actionName: 'Invite Link Added',
        lure: lureMeta.id,
        inviteType:
          lureMeta.inviteType && lureMeta.inviteType === 'user'
            ? 'user'
            : 'group',
      });

      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }, { name: 'Signup' }],
      });
    }
  }, [lureMeta, navigation]);

  const onHandlePasteClick = useCallback(async () => {
    const clipboardContents = await Clipboard.getString();
    setValue('inviteLink', clipboardContents);
  }, [setValue]);

  return (
    <KeyboardAvoidingView keyboardVerticalOffset={0}>
      <View
        flex={1}
        backgroundColor="$background"
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
      >
        <YStack flex={1} gap="$2xl" paddingTop="$2xl">
          <View paddingHorizontal="$xl">
            <ScreenHeader.BackButton onPress={() => navigation.goBack()} />
          </View>
          <SplashTitle>
            Paste your <Text color="$positiveActionText">invite.</Text>
          </SplashTitle>
          <SplashParagraph marginBottom={0}>
            Enter the invite code or link from someone you know on Tlon.
          </SplashParagraph>
          <YStack paddingHorizontal="$xl" gap="$m">
            <Controller
              control={control}
              name="inviteLink"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field error={metadataError ?? errors.inviteLink?.message}>
                  <TextInput
                    placeholder="TLON or join.tlon.io/0v4.pca…"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    rightControls={
                      <TextInput.InnerButton
                        label="Paste"
                        onPress={onHandlePasteClick}
                      />
                    }
                  />
                </Field>
              )}
            />
            <XStack justifyContent="center" minHeight={24}>
              {checkingInput && <LoadingSpinner />}
            </XStack>
          </YStack>
        </YStack>
        <YStack paddingHorizontal="$xl" gap="$l" marginTop="$xl">
          <Button
            preset="secondary"
            backgroundColor="transparent"
            label="No invite? Join waitlist"
            onPress={() => navigation.navigate('JoinWaitList', {})}
          />
        </YStack>
      </View>
    </KeyboardAvoidingView>
  );
};
