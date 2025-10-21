import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DEFAULT_INVITE_LINK_URL } from '@tloncorp/app/constants';
import { useBranch, useLureMetadata } from '@tloncorp/app/contexts/branch';
import { useTelemetryId } from '@tloncorp/app/hooks/useTelemetry';
import {
  Button,
  Field,
  Image,
  Pressable,
  ScreenHeader,
  TextInput,
  View,
  XStack,
  YStack,
} from '@tloncorp/app/ui';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import { checkInputForInvite, createDevLogger } from '@tloncorp/shared';
import { useCallback, useEffect, useState } from 'react';
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

  const {
    control,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<FormData>({
    defaultValues: {
      inviteLink: DEFAULT_INVITE_LINK_URL,
    },
  });

  const [metadataError, setMetadataError] = useState<string | null>(null);

  // watch for changes to the input & check for valid invite links
  const inviteLinkValue = watch('inviteLink');
  useEffect(() => {
    async function handleInviteLinkChange() {
      setMetadataError(null);
      try {
        const appInvite = await checkInputForInvite(inviteLinkValue, {
          telemetryId: telemetryId(),
        });
        if (appInvite) {
          setLure(appInvite);
          return;
        }
        trigger('inviteLink');
      } catch (e) {
        setMetadataError('Unable to check invite');
      }
    }
    handleInviteLinkChange();
  }, [inviteLinkValue, setLure, telemetryId, trigger]);

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
        title="Claim Invite"
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
          <YStack paddingHorizontal="$2xl" flex={1}>
            <XStack justifyContent="center">
              <Image
                width={80}
                height={80}
                source={require('../../../assets/images/welcome-icon.png')}
              />
            </XStack>
            <View padding="$4xl" gap="$xl">
              {/* <TlonText.Text size="$body" color="$primaryText">
                We&apos;re growing slowly. Invites let you skip the waitlist
                because we know someone wants to talk to you here.
                {'\n\n'}
              If you used an{' '}
              <TlonText.Text fontWeight="500">Invite Link</TlonText.Text> to
              download the app, tap it again now or paste it below.
              </TlonText.Text> */}
            </View>
            <YStack flex={1} justifyContent="space-between">
              <Controller
                control={control}
                name="inviteLink"
                // rules={{
                //   pattern: {
                //     value: INVITE_LINK_REGEX,
                //     message: 'Invite link not recognized.',
                //   },
                // }}
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
              <Button
                secondary
                backgroundColor="unset"
                marginBottom="$l"
                onPress={() => navigation.navigate('JoinWaitList', {})}
              >
                <Button.Text>No invite? Join waitlist</Button.Text>
              </Button>
            </YStack>
          </YStack>
        </Pressable>
      </SafeAreaView>
    </View>
  );
};
