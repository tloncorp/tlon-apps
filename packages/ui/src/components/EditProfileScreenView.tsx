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
import { ControlledTextField, ControlledTextareaField, Field } from './Form';
import KeyboardAvoidingView from './KeyboardAvoidingView';
import { ScreenHeader } from './ScreenHeader';

interface Props {
  onGoBack: () => void;
  onSaveProfile: (update: api.ProfileUpdate | null) => void;
  onUpdatePinnedGroups: (groups: db.Group[]) => void;
  onUpdateCoverImage: (coverImage: string) => void;
  onUpdateAvatarImage: (avatarImage: string) => void;
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
  } = useForm({
    defaultValues: {
      nickname: userContact?.nickname ?? '',
      bio: userContact?.bio ?? '',
    },
  });

  const onSavePressed = useCallback(() => {
    if (isDirty) {
      return handleSubmit((formData) => {
        props.onSaveProfile(formData);
      })();
    }
  }, [handleSubmit, isDirty, props]);

  const handlePressDone = () => {
    props.onGoBack();
    onSavePressed();
  };

  const handlePressCancel = () => {
    props.onGoBack();
  };

  const handleUpdatePinnedGroups = useCallback(
    (groups: db.Group[]) => {
      setPinnedGroups(groups);
      props.onUpdatePinnedGroups(groups);
    },
    [props]
  );

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
                onSetCoverUrl={props.onUpdateCoverImage}
                onSetIconUrl={props.onUpdateAvatarImage}
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

              <Field label="Pinned groups">
                <FavoriteGroupsDisplay
                  groups={pinnedGroups}
                  onUpdate={handleUpdatePinnedGroups}
                  editable
                />
              </Field>
            </View>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
