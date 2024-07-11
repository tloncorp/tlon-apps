import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { useForm } from 'react-hook-form';

import { useContact } from '../contexts';
import { ScrollView, View, YStack } from '../core';
import { EditablePofileImages } from './EditableProfileImages';
import { FormTextInput } from './FormInput';
import { GenericHeader } from './GenericHeader';
import { SaveButton } from './GroupMetaScreenView';

interface Props {
  currentUserId: string;
  uploadInfo: api.UploadInfo;
  onGoBack: () => void;
  onSaveProfile: (update: api.ProfileUpdate) => void;
}

export function EditProfileScreenView(props: Props) {
  const userContact = useContact(props.currentUserId);
  const {
    control,
    handleSubmit,
    formState: { errors },
    getValues,
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
    <View marginHorizontal="$xl" flex={1}>
      <GenericHeader
        title="Edit Profile"
        goBack={props.onGoBack}
        rightContent={
          <SaveButton onPress={handleSubmit(props.onSaveProfile)} />
        }
      />
      <ScrollView>
        <YStack>
          <EditablePofileImages
            contact={userContact ?? db.getFallbackContact(props.currentUserId)}
            uploadInfo={props.uploadInfo}
            onSetCoverUrl={(url) => setValue('coverImage', url)}
            onSetIconUrl={(url) => setValue('avatarImage', url)}
          />

          <FormTextInput>
            <FormTextInput.Label>Nickname</FormTextInput.Label>
            <FormTextInput.Input
              control={control}
              errors={errors}
              name="nickname"
              label="Nickname"
              placeholder={userContact?.id}
            />
          </FormTextInput>

          <FormTextInput>
            <FormTextInput.Label>Bio</FormTextInput.Label>
            <FormTextInput.Input
              control={control}
              errors={errors}
              name="bio"
              label="Bio"
              placeholder="About yourself"
              frameProps={{
                height: 'unset',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                overflow: 'scroll',
              }}
              areaProps={{
                numberOfLines: 5,
                display: 'flex',
                justifyContent: 'flex-start',
              }}
            />
          </FormTextInput>
        </YStack>
      </ScrollView>
    </View>
  );
}
