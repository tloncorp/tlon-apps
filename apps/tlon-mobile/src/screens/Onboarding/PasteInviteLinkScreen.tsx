import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BRANCH_DOMAIN,
  BRANCH_KEY,
  DEFAULT_INVITE_LINK_URL,
} from '@tloncorp/app/constants';
import { useBranch, useLureMetadata } from '@tloncorp/app/contexts/branch';
import { trackError } from '@tloncorp/app/utils/posthog';
import {
  DeepLinkData,
  createInviteLinkRegex,
  extractNormalizedInviteLink,
  getMetadaFromInviteLink,
} from '@tloncorp/shared/dist';
import {
  Field,
  ScreenHeader,
  TextInputWithButton,
  TlonText,
  View,
  YStack,
} from '@tloncorp/ui';
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
      const extractedLink = extractNormalizedInviteLink(
        inviteLinkValue,
        BRANCH_DOMAIN
      );
      setMetadataError(null);
      if (extractedLink) {
        try {
          const inviteLinkMeta = await getMetadaFromInviteLink(
            extractedLink,
            BRANCH_KEY
          );
          if (inviteLinkMeta) {
            setLure(inviteLinkMeta as DeepLinkData);
            return;
          } else {
            throw new Error('Failed to retrieve invite metadata');
          }
        } catch (e) {
          trackError({
            message: e.message,
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
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }, { name: 'SignUpEmail' }],
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
            onPress={() => navigation.navigate('SignUpEmail')}
          >
            Next
          </ScreenHeader.TextButton>
        }
      />
      <YStack
        paddingHorizontal="$2xl"
        gap="$m"
        onPress={() => Keyboard.dismiss()}
        flex={1}
      >
        <View padding="$xl" gap="$xl">
          <TlonText.Text size="$body" color="$primaryText">
            We&apos;re growing slowly. {'\n\n'}Invites let you skip the waitlist
            because we know someone wants to talk to you here.
            {'\n\n'}
            Click your invite link now or paste it below.
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
              <TextInputWithButton
                placeholder="join.tlon.io/0v4.pca0n.evapv..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                buttonText="Paste"
                onButtonPress={onHandlePasteClick}
              />
            </Field>
          )}
        />
      </YStack>
    </View>
  );
};
