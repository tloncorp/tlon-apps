import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BRANCH_DOMAIN, BRANCH_KEY } from '@tloncorp/app/constants';
import { useBranch, useLureMetadata } from '@tloncorp/app/contexts/branch';
import {
  DeepLinkData,
  createInviteLinkRegex,
  extractNormalizedInviteLink,
  getMetadaFromInviteLink,
} from '@tloncorp/shared/dist';
import {
  AppInviteDisplay,
  Field,
  PrimaryButton,
  ScreenHeader,
  SizableText,
  TextInputWithButton,
  View,
  YStack,
} from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';

import type { OnboardingStackParamList } from '../../types';

const INVITE_LINK_REGEX = createInviteLinkRegex(BRANCH_DOMAIN);

type Props = NativeStackScreenProps<OnboardingStackParamList, 'InviteLink'>;

type FormData = {
  inviteLink: string;
};

export const InviteLinkScreen = ({ navigation }: Props) => {
  const lureMeta = useLureMetadata();
  const { setLure } = useBranch();
  const [hasInvite, setHasInvite] = useState<boolean>(Boolean(lureMeta));

  const {
    control,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<FormData>();

  // watch for changes to the input & check for valid invite links
  const inviteLinkValue = watch('inviteLink');
  useEffect(() => {
    async function handleInviteLinkChange() {
      const extractedLink = extractNormalizedInviteLink(
        inviteLinkValue,
        BRANCH_DOMAIN
      );
      if (extractedLink) {
        const inviteLinkMeta = await getMetadaFromInviteLink(
          extractedLink,
          BRANCH_KEY
        );
        if (inviteLinkMeta) {
          setLure(inviteLinkMeta as DeepLinkData);
          return;
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
      setHasInvite(true);
    }
  }, [lureMeta]);

  // handle paste button click
  const onHandlePasteClick = useCallback(async () => {
    const clipboardContents = await Clipboard.getString();
    setValue('inviteLink', clipboardContents);
  }, [setValue]);

  return (
    <View flex={1}>
      <ScreenHeader
        title="Have an invite?"
        showSessionStatus={false}
        backAction={() => navigation.goBack()}
      />
      <YStack
        padding="$2xl"
        gap="$2xl"
        onPress={() => Keyboard.dismiss()}
        flex={1}
      >
        {!hasInvite ? (
          <>
            <View paddingHorizontal="$m" gap="$xl">
              <SizableText color="$primaryText">
                We&apos;re growing slowly. Invites let you skip the waitlist
                because we know someone wants to talk to you here.
              </SizableText>
              <SizableText color="$primaryText">
                Click your invite link now or paste it below.
              </SizableText>
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
                <Field label="Invite Link" error={errors.inviteLink?.message}>
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

            <PrimaryButton
              onPress={() => navigation.navigate('JoinWaitList', {})}
            >
              I don&apos;t have an invite
            </PrimaryButton>
          </>
        ) : (
          <>
            <SizableText marginLeft="$m" color="$positiveActionText">
              Invite found!
            </SizableText>
            <AppInviteDisplay metadata={lureMeta!} />
            <PrimaryButton onPress={() => navigation.navigate('SignUpEmail')}>
              Sign up
            </PrimaryButton>
          </>
        )}
      </YStack>
    </View>
  );
};