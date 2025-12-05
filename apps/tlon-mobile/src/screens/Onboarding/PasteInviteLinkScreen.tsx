import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEFAULT_INVITE_LINK_URL } from '@tloncorp/app/constants';
import { useBranch, useLureMetadata } from '@tloncorp/app/contexts/branch';
import { useTelemetryId } from '@tloncorp/app/hooks/useTelemetry';
import {
  Button,
  Field,
  Image,
  LoadingSpinner,
  Pressable,
  ScreenHeader,
  TextInput,
  View,
  XStack,
  YStack,
} from '@tloncorp/app/ui';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { checkInputForInvite, createDevLogger } from '@tloncorp/shared';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  // watch for changes to the input & check for valid invite links
  const inviteLinkValue = watch('inviteLink');
  useEffect(() => {
    debouncedInputHandler(inviteLinkValue);
  }, [inviteLinkValue, debouncedInputHandler]);

  // if at any point we have invite metadata, notify & allow them to proceed
  // to signup
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

  // handle paste button click
  const onHandlePasteClick = useCallback(async () => {
    const clipboardContents = await Clipboard.getString();
    setValue('inviteLink', clipboardContents);
  }, [setValue]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        showSessionStatus={false}
        backAction={() => navigation.goBack()}
        rightControls={
          <ScreenHeader.TextButton
            disabled={!lureMeta}
            onPress={() => navigation.navigate('Signup')}
          >
            Next
          </ScreenHeader.TextButton>
        }
      />
      <SafeAreaView style={{ flex: 1 }}>
        <Pressable
          flex={1}
          pressStyle={{ opacity: 1 }}
          onPress={() => Keyboard.dismiss()}
        >
          <YStack marginTop="$4xl" paddingHorizontal="$2xl" flex={1}>
            <XStack justifyContent="center">
              <Image
                width={80}
                height={80}
                source={require('../../../assets/images/welcome-icon.png')}
              />
            </XStack>
            <YStack marginTop="$6xl" flex={1} justifyContent="space-between">
              <YStack>
                <Controller
                  control={control}
                  name="inviteLink"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Field
                      label="Invite code or link"
                      error={metadataError ?? errors.inviteLink?.message}
                      paddingTop="$l"
                    >
                      <TextInput
                        placeholder="TLON  or  join.tlon.io/0v4.pca..."
                        // fontSize="$3xl"
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
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
                <XStack marginTop="$2xl" justifyContent="center">
                  {checkingInput && <LoadingSpinner />}
                </XStack>
              </YStack>
              <Button
                type="secondary"
                fill="text"
                marginBottom="$l"
                width="100%"
                onPress={() => navigation.navigate('JoinWaitList', {})}
                label="No invite? Join waitlist"
                centered
              />
            </YStack>
          </YStack>
        </Pressable>
      </SafeAreaView>
    </View>
  );
};
