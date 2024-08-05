import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { ImagePickerAsset } from 'expo-image-picker';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { ScrollView, View, YStack } from 'tamagui';

import { useContact, useCurrentUserId } from '../contexts';
import { AttachmentProvider } from '../contexts/attachment';
import { EditablePofileImages } from './EditableProfileImages';
import { FormTextInput } from './FormInput';
import { GenericHeader } from './GenericHeader';
import { SaveButton } from './GroupMetaScreenView';
import KeyboardAvoidingView from './KeyboardAvoidingView';

interface Props {
  onGoBack: () => void;
  onSaveProfile: (update: api.ProfileUpdate) => void;
  uploadAsset: (asset: ImagePickerAsset) => Promise<void>;
  canUpload: boolean;
}

export function EditProfileScreenView(props: Props) {
  const currentUserId = useCurrentUserId();
  const userContact = useContact(currentUserId);
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm({
    defaultValues: {
      nickname: userContact?.nickname ?? '',
      bio: userContact?.bio ?? '',
      avatarImage: userContact?.avatarImage ?? '',
      coverImage: userContact?.coverImage ?? '',
    },
  });

  return (
    <AttachmentProvider
      canUpload={props.canUpload}
      uploadAsset={props.uploadAsset}
    >
      <View flex={1}>
        <GenericHeader
          title="Edit Profile"
          goBack={props.onGoBack}
          rightContent={
            <SaveButton onPress={handleSubmit(props.onSaveProfile)} />
          }
        />
        <KeyboardAvoidingView>
          <ScrollView>
            <YStack
              onTouchStart={Keyboard.dismiss}
              marginTop="$l"
              marginHorizontal="$xl"
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
            </YStack>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </AttachmentProvider>
  );
}
