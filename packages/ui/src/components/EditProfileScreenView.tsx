import * as db from '@tloncorp/shared/db';
import { Button, useStore } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, SizableText, View, XStack } from 'tamagui';

import { useContact, useCurrentUserId } from '../contexts';
import { SigilAvatar } from './Avatar';
import { FavoriteGroupsDisplay } from './FavoriteGroupsDisplay';
import {
  ControlledImageField,
  ControlledTextField,
  ControlledTextareaField,
  Field,
  FormFrame,
} from './Form';
import KeyboardAvoidingView from './KeyboardAvoidingView';
import { ScreenHeader } from './ScreenHeader';
import { Text } from './TextV2';
import { BioDisplay, PinnedGroupsDisplay } from './UserProfileScreenView';
import { VerifyPhoneNumberSheet } from './VerifyPhoneNumberSheet';

interface Props {
  userId: string;
  onGoBack: () => void;
}

export function EditProfileScreenView(props: Props) {
  const store = useStore();
  const [verifyPhoneOpen, setVerifyPhoneOpen] = useState(false);
  const {
    verification: phoneVerification,
    isLoading: phoneVerificationLoading,
  } = store.usePhoneVerification();
  const insets = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();
  const userContact = useContact(props.userId);
  const [pinnedGroups, setPinnedGroups] = useState<db.Group[]>(
    (userContact?.pinnedGroups
      ?.map((pin) => pin.group)
      .filter(Boolean) as db.Group[]) ?? []
  );

  const isCurrUser = useMemo(
    () => props.userId === currentUserId,
    [props.userId, currentUserId]
  );

  const currentNickname = useMemo(() => {
    return isCurrUser
      ? userContact?.nickname
      : userContact?.customNickname ?? '';
  }, [isCurrUser, userContact?.nickname, userContact?.customNickname]);

  const nicknamePlaceholder = useMemo(() => {
    return isCurrUser
      ? userContact?.id
      : userContact?.peerNickname ?? userContact?.id;
  }, [isCurrUser, userContact]);

  const currentAvatarImage = useMemo(() => {
    return isCurrUser
      ? userContact?.avatarImage
      : userContact?.customAvatarImage ?? '';
  }, [isCurrUser, userContact]);

  const avatarPlaceholder = useMemo(() => {
    return isCurrUser ? undefined : userContact?.peerAvatarImage ?? undefined;
  }, [isCurrUser, userContact]);

  const [hasVerifiedPhone, sethasVerifiedPhone] = useState<boolean | null>(
    null
  );

  // Always show button if it was unverified when you opened the screen
  useEffect(() => {
    if (!phoneVerificationLoading && hasVerifiedPhone === null) {
      sethasVerifiedPhone(phoneVerification?.status === 'verified');
    }
  }, [hasVerifiedPhone, phoneVerification, phoneVerificationLoading]);
  const [fakePhoneVisible, setFakePhoneVisible] = useState(true);

  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      nickname: currentNickname ?? '',
      status: userContact?.status ?? '',
      bio: userContact?.bio ?? '',
      avatarImage: currentAvatarImage ?? '',
    },
  });

  const handlePressDone = useCallback(() => {
    if (isDirty) {
      handleSubmit((formData) => {
        const nicknameStartVal = isCurrUser
          ? userContact?.nickname
          : userContact?.customNickname;
        const avatarStartVal = isCurrUser
          ? userContact?.avatarImage
          : userContact?.customAvatarImage;

        const update = {
          status: formData.status,
          bio: formData.bio,
          nickname: formData.nickname
            ? formData.nickname
            : nicknameStartVal
              ? null // clear existing
              : undefined,
          avatarImage: formData.avatarImage
            ? formData.avatarImage
            : avatarStartVal
              ? null // clear existing
              : undefined,
        };

        if (isCurrUser) {
          store.updateCurrentUserProfile(update);
        } else {
          store.updateContactMetadata(props.userId, {
            nickname: update.nickname,
            avatarImage: update.avatarImage,
          });
        }
      })();
    }
    props.onGoBack();
  }, [
    handleSubmit,
    isCurrUser,
    isDirty,
    props,
    store,
    userContact?.avatarImage,
    userContact?.customAvatarImage,
    userContact?.customNickname,
    userContact?.nickname,
  ]);

  const handlePressCancel = () => {
    if (isDirty) {
      Alert.alert('Discard changes?', 'Your changes will not be saved.', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            props.onGoBack();
          },
        },
      ]);
    } else {
      props.onGoBack();
    }
  };

  const handleUpdatePinnedGroups = useCallback((groups: db.Group[]) => {
    setPinnedGroups(groups);
    store.updateProfilePinnedGroups(groups);
  }, []);

  return (
    <View flex={1}>
      <ScreenHeader
        title="Edit Profile"
        leftControls={
          <ScreenHeader.TextButton onPress={handlePressCancel}>
            Cancel
          </ScreenHeader.TextButton>
        }
        rightControls={
          <ScreenHeader.TextButton
            onPress={handlePressDone}
            color="$positiveActionText"
            disabled={!isValid}
          >
            Done
          </ScreenHeader.TextButton>
        }
      />

      <KeyboardAvoidingView>
        <ScrollView keyboardDismissMode="on-drag">
          <FormFrame paddingBottom={insets.bottom}>
            <XStack alignItems="flex-end" gap="$m">
              <View flex={1}>
                <ControlledTextField
                  name="nickname"
                  label="Nickname"
                  control={control}
                  renderInputContainer={
                    isCurrUser
                      ? ({ children }) => {
                          return (
                            <XStack gap="$m">
                              <View flex={1}>{children}</View>
                              <SigilAvatar
                                contactId={currentUserId}
                                width={56}
                                height={56}
                                borderRadius="$l"
                                size="custom"
                              />
                            </XStack>
                          );
                        }
                      : undefined
                  }
                  inputProps={{ placeholder: nicknamePlaceholder }}
                  rules={{
                    maxLength: {
                      value: 30,
                      message: 'Your nickname is limited to 30 characters',
                    },
                  }}
                />
              </View>
            </XStack>

            <ControlledImageField
              label="Avatar image"
              name="avatarImage"
              hideError={true}
              control={control}
              inputProps={{
                buttonLabel: 'Change avatar image',
                placeholderUri: avatarPlaceholder,
              }}
              rules={{
                pattern: {
                  value: /^(?!file).+/,
                  message: 'Image has not finished uploading',
                },
              }}
            />

            {isCurrUser ? (
              <>
                <ControlledTextField
                  name="status"
                  label="Status"
                  control={control}
                  inputProps={{
                    placeholder: 'Hanging out...',
                  }}
                  rules={{
                    maxLength: {
                      value: 50,
                      message: 'Your status is limited to 50 characters',
                    },
                  }}
                />
                <ControlledTextareaField
                  name="bio"
                  label="Bio"
                  control={control}
                  inputProps={{
                    placeholder: 'About yourself',
                    numberOfLines: 5,
                    multiline: true,
                  }}
                  rules={{
                    maxLength: {
                      value: 300,
                      message: 'Your bio is limited to 300 characters',
                    },
                  }}
                />
                <Field label="Pinned groups">
                  <FavoriteGroupsDisplay
                    groups={pinnedGroups}
                    onUpdate={handleUpdatePinnedGroups}
                  />
                </Field>

                {hasVerifiedPhone ? (
                  <Field label="Share Phone Verification" paddingBottom="$2xl">
                    {/* <Switch
                      value={fakePhoneVisible}
                      onValueChange={setFakePhoneVisible}
                    /> */}
                    <XStack
                      backgroundColor="$background"
                      borderRadius="$l"
                      borderWidth={1}
                      borderColor="$border"
                      paddingHorizontal="$xl"
                      paddingVertical="$l"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <SizableText color="$primaryText">
                        Share on profile
                      </SizableText>
                      <Switch
                        value={fakePhoneVisible}
                        onValueChange={setFakePhoneVisible}
                      />
                    </XStack>
                    <Text
                      color="$tertiaryText"
                      paddingBottom="$l"
                      paddingTop="$m"
                      marginLeft="$s"
                    >
                      You can let others know you've verified a phone number
                      without revealing what the number is.
                    </Text>
                  </Field>
                ) : (
                  <Field label="Share Phone Verification">
                    <Button hero onPress={() => setVerifyPhoneOpen(true)}>
                      <Button.Text>Manage verifications</Button.Text>
                    </Button>
                  </Field>
                )}
              </>
            ) : (
              <>
                <BioDisplay
                  bio={userContact?.bio ?? ''}
                  backgroundColor="$secondaryBackground"
                />
                <PinnedGroupsDisplay
                  groups={pinnedGroups ?? []}
                  onPressGroup={() => {}}
                  backgroundColor="$secondaryBackground"
                />
              </>
            )}
          </FormFrame>
        </ScrollView>
      </KeyboardAvoidingView>
      <VerifyPhoneNumberSheet
        open={verifyPhoneOpen}
        onOpenChange={() => setVerifyPhoneOpen(false)}
        verification={phoneVerification}
        verificationLoading={phoneVerificationLoading}
      />
    </View>
  );
}
