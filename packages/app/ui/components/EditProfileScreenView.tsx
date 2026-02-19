import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import {
  getNicknameErrorMessage,
  validateNickname,
} from '@tloncorp/shared/logic';
import {
  DEFAULT_BOTTOM_PADDING,
  KEYBOARD_EXTRA_PADDING,
  KeyboardAvoidingView,
  Text,
  triggerHaptic,
  useIsWindowNarrow,
  useToast,
} from '@tloncorp/ui';
import { ConfirmDialog } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack, YStack, useTheme } from 'tamagui';

import { useContact, useCurrentUserId, useStore } from '../contexts';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import { SigilAvatar } from './Avatar';
import { EditAttestationsDisplay } from './EditProfile/EditAttestationsDisplay';
import { FavoriteGroupsDisplay } from './FavoriteGroupsDisplay';
import {
  ControlledColorField,
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

const PROFILE_WIDGET_DESK = 'groups';

const PUBLIC_PROFILE_WIDGETS: Array<{
  term: string;
  label: string;
}> = [
  { term: 'profile', label: 'Profile info' },
  { term: 'profile-bio', label: 'Bio' },
  { term: 'expose-all', label: 'Featured posts' },
  { term: 'join-button', label: 'Message me' },
];

const DEFAULT_WIDGET_STATE = PUBLIC_PROFILE_WIDGETS.reduce<
  Record<string, boolean>
>((acc, widget) => {
  acc[widget.term] = false;
  return acc;
}, {});

function getWidgetStateFromLayout(layout: api.PublicProfileWidget[]) {
  const visible = new Set(
    layout
      .filter((widget) => widget.desk === PROFILE_WIDGET_DESK)
      .map((widget) => widget.term)
  );

  return PUBLIC_PROFILE_WIDGETS.reduce<Record<string, boolean>>(
    (acc, widget) => {
      acc[widget.term] = visible.has(widget.term);
      return acc;
    },
    { ...DEFAULT_WIDGET_STATE }
  );
}

export function EditProfileScreenView(props: Props) {
  const store = useStore();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

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
    watch,
    formState: { isDirty, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      nickname: currentNickname ?? '',
      status: userContact?.status ?? '',
      bio: userContact?.bio ?? '',
      avatarImage: currentAvatarImage ?? '',
      sigilColor: userContact?.color ?? '',
    },
  });

  const currentSigilColor = watch('sigilColor');

  useEffect(() => {
    reset({
      nickname: currentNickname ?? '',
      status: userContact?.status ?? '',
      bio: userContact?.bio ?? '',
      avatarImage: currentAvatarImage ?? '',
      sigilColor: userContact?.color ?? '',
    });
  }, [
    props.userId,
    currentNickname,
    userContact?.status,
    userContact?.bio,
    userContact?.color,
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
        const colorStartVal = userContact?.color ?? '';

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
          const colorChanged = formData.sigilColor !== colorStartVal;
          if (colorChanged) {
            store.updateSigilColor(formData.sigilColor || null);
          }
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
    userContact?.color,
    userContact?.customAvatarImage,
    userContact?.customNickname,
    userContact?.nickname,
  ]);

  const handlePressCancel = () => {
    if (isDirty) {
      setDiscardDialogOpen(true);
    } else {
      props.onGoBack();
    }
  };

  const handleDiscardConfirm = () => {
    setDiscardDialogOpen(false);
    reset();
    props.onGoBack();
  };

  const handleUpdatePinnedGroups = useCallback(
    (groups: db.Group[]) => {
      setPinnedGroups(groups);
      store.updateProfilePinnedGroups(groups);
    },
    [store]
  );

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor={theme.background.val}>
      <ScreenHeader
        title="Edit Profile"
        backAction={handlePressCancel}
        borderBottom
        useHorizontalTitleLayout={!isWindowNarrow}
        rightControls={
          <ScreenHeader.TextButton
            onPress={handlePressDone}
            color="$positiveActionText"
            disabled={!isValid}
          >
            Save
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
                                contactOverride={{
                                  ...userContact,
                                  id: currentUserId,
                                  color: currentSigilColor || null,
                                }}
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
              <ControlledColorField
                name="sigilColor"
                label="Default avatar color"
                control={control}
              />
            ) : null}

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

                <PublicProfileControls />

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
      <ConfirmDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to discard them?"
        confirmText="Discard"
        destructive
        onConfirm={handleDiscardConfirm}
      />
    </View>
  );
}

function PublicProfileControls() {
  const showToast = useToast();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [widgetState, setWidgetState] =
    useState<Record<string, boolean>>(DEFAULT_WIDGET_STATE);
  const [updatingWidget, setUpdatingWidget] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [enabled, layout] = await Promise.all([
          api.getPublicProfileEnabled(),
          api.getPublicProfileLayout(),
        ]);
        if (active) {
          setIsEnabled(enabled);
          setWidgetState(getWidgetStateFromLayout(layout));
        }
      } catch (error) {
        console.warn('Failed to load public profile setting', error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleToggle = useCallback(
    async (nextValue: boolean) => {
      const prevValue = isEnabled;
      setIsEnabled(nextValue);
      setIsUpdating(true);

      try {
        await api.setPublicProfileEnabled(nextValue);
        if (nextValue) {
          const layout = await api.getPublicProfileLayout();
          setWidgetState(getWidgetStateFromLayout(layout));
        }
      } catch (error) {
        setIsEnabled(prevValue);
        triggerHaptic('error');
        showToast({
          message: 'Could not update public profile setting',
          duration: 2000,
        });
      } finally {
        setIsUpdating(false);
      }
    },
    [isEnabled, showToast]
  );

  const handleWidgetToggle = useCallback(
    async (term: string, nextValue: boolean) => {
      const prevValue = widgetState[term];
      if (prevValue === nextValue) {
        return;
      }

      setWidgetState((current) => ({
        ...current,
        [term]: nextValue,
      }));
      setUpdatingWidget(term);

      try {
        await api.setPublicProfileWidgetEnabled(
          { desk: PROFILE_WIDGET_DESK, term },
          nextValue
        );
      } catch (error) {
        setWidgetState((current) => ({
          ...current,
          [term]: prevValue,
        }));
        triggerHaptic('error');
        showToast({
          message: 'Could not update profile widget',
          duration: 2000,
        });
      } finally {
        setUpdatingWidget(null);
      }
    },
    [showToast, widgetState]
  );

  return (
    <Field label="Public profile">
      <XStack
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal="$xl"
        paddingVertical="$l"
        borderRadius="$l"
        backgroundColor="$secondaryBackground"
      >
        <Text size="$body">Public /profile page</Text>
        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          disabled={isLoading || isUpdating}
        />
      </XStack>
      <Text size="$label/s" color="$secondaryText" marginTop="$m">
        {isEnabled
          ? 'Your /profile page is public.'
          : 'Your /profile page is hidden.'}
      </Text>
      {isEnabled ? (
        <YStack
          marginTop="$l"
          gap="$m"
          paddingHorizontal="$xl"
          paddingVertical="$l"
          borderRadius="$l"
          backgroundColor="$secondaryBackground"
        >
          {PUBLIC_PROFILE_WIDGETS.map((widget) => (
            <XStack
              key={widget.term}
              justifyContent="space-between"
              alignItems="center"
            >
              <Text size="$body">{widget.label}</Text>
              <Switch
                value={widgetState[widget.term] ?? false}
                onValueChange={(value) => {
                  void handleWidgetToggle(widget.term, value);
                }}
                disabled={isLoading || isUpdating || updatingWidget !== null}
              />
            </XStack>
          ))}
        </YStack>
      ) : null}
    </Field>
  );
}
