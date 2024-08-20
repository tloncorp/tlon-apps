import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { useContact, useCurrentUserId } from '../contexts';
import { AttachmentProvider } from '../contexts/attachment';
import { EditablePofileImages } from './EditableProfileImages';
import { FavoriteGroupsDisplay } from './FavoriteGroupsDisplay';
import { FormTextInput } from './FormInput';
import { GenericHeader } from './GenericHeader';
import KeyboardAvoidingView from './KeyboardAvoidingView';
import { SaveButton } from './MetaEditorScreenView';

interface Props {
  onGoBack: () => void;
  onSaveProfile: (update: {
    profile: api.ProfileUpdate | null;
    pinnedGroups?: db.Group[] | null;
  }) => void;
  uploadAsset: (asset: ImagePickerAsset) => Promise<void>;
  canUpload: boolean;
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
      console.log(`form is dirty, handling submit?`);
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

  return (
    <AttachmentProvider
      canUpload={props.canUpload}
      uploadAsset={props.uploadAsset}
    >
      <View flex={1}>
        <GenericHeader
          title="Edit Profile"
          goBack={props.onGoBack}
          rightContent={<SaveButton onPress={onSavePressed} />}
        />
        <KeyboardAvoidingView>
          <ScrollView>
            <YStack
              onTouchStart={Keyboard.dismiss}
              marginTop="$l"
              marginHorizontal="$xl"
              paddingBottom={insets.bottom}
            >
              <EditablePofileImages
                contact={userContact ?? db.getFallbackContact(currentUserId)}
                onSetCoverUrl={useCallback(
                  (url: string) => setValue('coverImage', url),
                  [setValue]
                )}
                onSetIconUrl={useCallback(
                  (url: string) => setValue('avatarImage', url),
                  [setValue]
                )}
              />

              <FormTextInput marginTop="$m">
                <FormTextInput.Label>Nickname</FormTextInput.Label>
                <FormTextInput.Input
                  control={control}
                  errors={errors}
                  name="nickname"
                  label="Nickname"
                  rules={{
                    maxLength: {
                      value: 30,
                      message: 'Your nickname is limited to 30 characters',
                    },
                  }}
                  placeholder={userContact?.id}
                />
              </FormTextInput>

              <FormTextInput>
                <FormTextInput.Label>Bio</FormTextInput.Label>
                <FormTextInput.Input
                  control={control}
                  errors={errors}
                  rules={{
                    maxLength: {
                      value: 300,
                      message: 'Your bio is limited to 300 characters',
                    },
                  }}
                  name="bio"
                  label="Bio"
                  placeholder="About yourself"
                  frameProps={{
                    height: 'auto',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    overflow: 'scroll',
                  }}
                  areaProps={{
                    numberOfLines: 5,
                    multiline: true,
                  }}
                />
              </FormTextInput>

              <View marginTop="$2xl">
                <FavoriteGroupsDisplay
                  secondaryColors
                  groups={pinnedGroups}
                  editable
                  onUpdate={setPinnedGroups}
                />
              </View>
            </YStack>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </AttachmentProvider>
  );
}
