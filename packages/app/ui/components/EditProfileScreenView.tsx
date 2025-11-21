import * as db from '@tloncorp/shared/db';
import {
  getNicknameErrorMessage,
  validateNickname,
} from '@tloncorp/shared/logic';
import {
  DEFAULT_BOTTOM_PADDING,
  KEYBOARD_EXTRA_PADDING,
  KeyboardAvoidingView,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack, useTheme } from 'tamagui';

import { useContact, useCurrentUserId, useStore } from '../contexts';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import { SigilAvatar } from './Avatar';
import { EditAttestationsDisplay } from './EditProfile/EditAttestationsDisplay';
import { FavoriteGroupsDisplay } from './FavoriteGroupsDisplay';
import {
  ControlledImageField,
  ControlledTextField,
  ControlledTextareaField,
  Field,
  FormFrame,
} from './Form';
import { ScreenHeader } from './ScreenHeader';
import { BioDisplay, PinnedGroupsDisplay } from './UserProfileScreenView';

interface Props {
  userId: string;
  onGoBack: () => void;
  onGoToAttestation?: (type: 'twitter' | 'phone') => void;
}

export function EditProfileScreenView(props: Props) {
  const store = useStore();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();

  const {
    scrollViewRef,
    keyboardHeight,
    handleInputFocus,
    registerInputLayout,
    getInputPosition,
  } = useKeyboardAwareScroll();
  const userContact = useContact(props.userId);
  const [pinnedGroups, setPinnedGroups] = useState<db.Group[]>(
    (userContact?.pinnedGroups
      ?.map((pin) => pin.group)
      .filter(Boolean) as db.Group[]) ?? []
  );

  const attestations = useMemo(() => {
    return (userContact?.attestations
      ?.map((a) => a.attestation)
      .filter(Boolean) ?? []) as db.Attestation[];
  }, [userContact]);

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

  const {
    control,
    handleSubmit,
    reset,
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

  useEffect(() => {
    reset({
      nickname: currentNickname ?? '',
      status: userContact?.status ?? '',
      bio: userContact?.bio ?? '',
      avatarImage: currentAvatarImage ?? '',
    });
  }, [
    props.userId,
    currentNickname,
    userContact?.status,
    userContact?.bio,
    currentAvatarImage,
    reset,
  ]);

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
    <View flex={1} backgroundColor={theme.background.val}>
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
        <ScrollView
          ref={scrollViewRef}
          keyboardDismissMode="on-drag"
          flex={1}
          contentContainerStyle={{
            width: '100%',
            maxWidth: 600,
            marginHorizontal: 'auto',
            paddingBottom:
              keyboardHeight > 0
                ? keyboardHeight + KEYBOARD_EXTRA_PADDING
                : insets.bottom + DEFAULT_BOTTOM_PADDING,
          }}
        >
          <FormFrame>
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
                  inputProps={{
                    placeholder: nicknamePlaceholder,
                    testID: 'ProfileNicknameInput',
                  }}
                  rules={{
                    maxLength: {
                      value: 30,
                      message: 'Your nickname is limited to 30 characters',
                    },
                    validate: (value) => {
                      if (!isCurrUser) {
                        return true;
                      }
                      const result = validateNickname(value, currentUserId);
                      if (!result.isValid) {
                        return getNicknameErrorMessage(result.errorType);
                      }
                      return true;
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
                  value: /^(?!file|data).+/,
                  message: 'Image has not finished uploading',
                },
              }}
            />

            {isCurrUser ? (
              <>
                <View onLayout={registerInputLayout('status')}>
                  <ControlledTextField
                    name="status"
                    label="Status"
                    control={control}
                    inputProps={{
                      placeholder: 'Hanging out...',
                      onFocus: () => {
                        const position = getInputPosition('status');
                        if (position !== undefined) {
                          handleInputFocus(position);
                        }
                      },
                    }}
                    rules={{
                      maxLength: {
                        value: 50,
                        message: 'Your status is limited to 50 characters',
                      },
                    }}
                  />
                </View>
                <View onLayout={registerInputLayout('bio')}>
                  <ControlledTextareaField
                    name="bio"
                    label="Bio"
                    control={control}
                    inputProps={{
                      placeholder: 'About yourself',
                      numberOfLines: 5,
                      multiline: true,
                      onFocus: () => {
                        const position = getInputPosition('bio');
                        if (position !== undefined) {
                          handleInputFocus(position);
                        }
                      },
                    }}
                    rules={{
                      maxLength: {
                        value: 300,
                        message: 'Your bio is limited to 300 characters',
                      },
                    }}
                  />
                </View>
                <Field label="Pinned groups">
                  <FavoriteGroupsDisplay
                    groups={pinnedGroups}
                    onUpdate={handleUpdatePinnedGroups}
                  />
                </Field>

                <EditAttestationsDisplay
                  attestations={attestations}
                  onPressAttestation={props.onGoToAttestation}
                />
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
                  itemProps={{ backgroundColor: '$secondaryBackground' }}
                />
              </>
            )}
          </FormFrame>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
