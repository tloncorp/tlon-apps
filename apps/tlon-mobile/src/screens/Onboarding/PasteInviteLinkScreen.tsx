import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BRANCH_DOMAIN,
  BRANCH_KEY,
  DEFAULT_INVITE_LINK_URL,
} from '@tloncorp/app/constants';
import { useBranch, useLureMetadata } from '@tloncorp/app/contexts/branch';
import {
  Button,
  Field,
  OnboardingButton,
  Pressable,
  ScreenHeader,
  TextInput,
  TlonText,
  View,
  YStack,
} from '@tloncorp/app/ui';
import { trackOnboardingAction } from '@tloncorp/app/utils/posthog';
import {
  createDevLogger,
  createInviteLinkRegex,
  extractNormalizedInviteLink,
  getInviteLinkMeta,
} from '@tloncorp/shared';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';

import type { OnboardingStackParamList } from '../../types';

const INVITE_LINK_REGEX = createInviteLinkRegex(BRANCH_DOMAIN);

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  'PasteInviteLink'
>;

type FormData = {
  inviteLink: string;
};

const logger = createDevLogger('PasteInviteLinkScreen', true);

export const PasteInviteLinkScreen = ({ navigation }: Props) => {
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
      const extractedLink = extractNormalizedInviteLink(inviteLinkValue);
      setMetadataError(null);
      if (extractedLink) {
        try {
          const appInvite = await getInviteLinkMeta({
            inviteLink: extractedLink,
          });
          if (appInvite) {
            setLure(appInvite);
            return;
          } else {
            throw new Error('Failed to retrieve invite metadata');
          }
        } catch (e) {
          logger.trackError('Error retrieving invite metadata', {
            errorMessage: e.message,
            properties: {
              inviteLink: extractedLink,
              branchDomain: BRANCH_DOMAIN,
              branchKey: BRANCH_KEY,
            },
          });
          setMetadataError('Unable to load invite');
        }
      }
      trigger('inviteLink');
    }
    handleInviteLinkChange();
  }, [inviteLinkValue, setLure, trigger]);

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
      <Pressable
        flex={1}
        pressStyle={{ opacity: 1 }}
        onPress={() => Keyboard.dismiss()}
      >
        <YStack paddingHorizontal="$2xl" gap="$m" flex={1}>
          <View padding="$xl" gap="$xl">
            <TlonText.Text size="$body" color="$primaryText">
              We&apos;re growing slowly. Invites let you skip the waitlist
              because we know someone wants to talk to you here.
              {'\n\n'}
              If you used an{' '}
              <TlonText.Text fontWeight="500">Invite Link</TlonText.Text> to
              download the app, tap it again now or paste it below.
            </TlonText.Text>
          </View>
          <Controller
            control={control}
            name="inviteLink"
            rules={{
              pattern: {
                value: INVITE_LINK_REGEX,
                message: 'Invite link not recognized.',
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Invite Link"
                error={metadataError ?? errors.inviteLink?.message}
                paddingTop="$l"
              >
                <TextInput
                  placeholder="join.tlon.io/0v4.pca0n.evapv..."
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
          <TlonText.Text
            color="$secondaryText"
            marginTop="$xl"
            textAlign="center"
          >
            Don't have an invite?{` `}
            <Pressable
              pressStyle={{
                opacity: 0.5,
              }}
              onPress={() => navigation.navigate('JoinWaitList', {})}
              style={{ marginBottom: -3 }}
            >
              <TlonText.Text
                color="$secondaryText"
                textDecorationLine="underline"
                textDecorationDistance={10}
              >
                Join the waitlist
              </TlonText.Text>
            </Pressable>
          </TlonText.Text>
        </YStack>
      </Pressable>
    </View>
  );
};
