import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { useContact, useCurrentUserId } from '../contexts';
import { EditablePofileImages } from './EditableProfileImages';
import { FavoriteGroupsDisplay } from './FavoriteGroupsDisplay';
import {
  ControlledField,
  ControlledTextField,
  ControlledTextareaField,
} from './Form';
import KeyboardAvoidingView from './KeyboardAvoidingView';
import { ScreenHeader } from './ScreenHeader';

interface Props {
  onGoBack: () => void;
  onSaveProfile: (update: {
    profile: api.ProfileUpdate | null;
    pinnedGroups?: db.Group[] | null;
  }) => void;
}

export function EditProfileScreenView(props: Props) {
  const insets = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();
  const userContact = useContact(currentUserId);
  const [pinnedGroups, setPinnedGroups] = useState<db.Group[]>(
    (userContact?.pinnedGroups
      ?.map((pin) => pin.group)
      .filter(Boolean) as db.Group[]) ?? []
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
  } = useForm({
    defaultValues: {
      nickname: userContact?.nickname ?? '',
      bio: userContact?.bio ?? '',
      avatarImage: userContact?.avatarImage ?? '',
      coverImage: userContact?.coverImage ?? '',
      pinnedGroups: userContact?.pinnedGroups?.map((pin) => pin.group) ?? [],
    },
  });

  const onSavePressed = useCallback(() => {
    // only pass pins to the save handler if changes were made
    const initialPinnedIds = userContact?.pinnedGroups
      ?.map((pin) => pin.group?.id)
      .filter(Boolean) as string[];
    const newPinnedIds = pinnedGroups.map((group) => group.id);
    const didEditPinnedGroups =
      initialPinnedIds.length !== newPinnedIds.length ||
      !initialPinnedIds.every((id) => newPinnedIds.includes(id));

    if (isDirty) {
      return handleSubmit((formData) => {
        props.onSaveProfile({
          profile: formData,
          pinnedGroups: didEditPinnedGroups ? pinnedGroups : undefined,
        });
      })();
    }

    if (didEditPinnedGroups) {
      return props.onSaveProfile({
        profile: null,
        pinnedGroups,
      });
    }
  }, [handleSubmit, isDirty, pinnedGroups, props, userContact?.pinnedGroups]);

  const handlePressDone = () => {
    props.onGoBack();
    onSavePressed();
  };

  const handlePressCancel = () => {
    props.onGoBack();
  };

  return (
    <View flex={1}>
      <ScreenHeader
        backAction={handlePressCancel}
        title="Edit Profile"
        rightControls={
          <ScreenHeader.TextButton onPress={handlePressDone}>
            Done
          </ScreenHeader.TextButton>
        }
      />

      <KeyboardAvoidingView>
        <ScrollView>
          <YStack
            onTouchStart={Keyboard.dismiss}
            gap="$2xl"
            paddingBottom={insets.bottom}
          >
            <View paddingHorizontal="$xl">
              <EditablePofileImages
                contact={userContact ?? db.getFallbackContact(currentUserId)}
                onSetCoverUrl={useCallback(
                  (url: string) =>
                    setValue('coverImage', url, { shouldDirty: true }),
                  [setValue]
                )}
                onSetIconUrl={useCallback(
                  (url: string) =>
                    setValue('avatarImage', url, { shouldDirty: true }),
                  [setValue]
                )}
              />
            </View>
            <View paddingHorizontal="$2xl" gap="$2xl">
              <ControlledTextField
                name="nickname"
                label="Nickname"
                control={control}
                inputProps={{ placeholder: userContact?.id }}
                rules={{
                  maxLength: {
                    value: 30,
                    message: 'Your nickname is limited to 30 characters',
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

              <ControlledField
                name={'pinnedGroups'}
                label="Pinned groups"
                control={control}
                renderInput={({ field: { onChange, value } }) => (
                  <FavoriteGroupsDisplay
                    groups={pinnedGroups}
                    onUpdate={setPinnedGroups}
                    editable
                  />
                )}
              />
            </View>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
