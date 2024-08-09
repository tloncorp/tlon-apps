import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { uploadAsset, useCanUpload } from '@tloncorp/shared/dist/store';
import {
  AttachmentProvider,
  FormInput,
  GenericHeader,
  KeyboardAvoidingView,
  SaveButton,
  View,
  YStack,
} from '@tloncorp/ui';
import { EditablePofileImages } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { RootStackParamList } from '../types';

type ChannelMetaScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ChannelMeta'
>;

export function ChannelMetaScreen(props: ChannelMetaScreenProps) {
  const { channelId } = props.route.params;
  const channelQuery = store.useChannel({ id: channelId });

  const canUpload = useCanUpload();

  const renderHeader = useCallback(
    ({ submit }: RenderHeaderParams) => {
      return (
        <GenericHeader
          title="Edit chat info"
          goBack={props.navigation.goBack}
          rightContent={<SaveButton onPress={submit} />}
        />
      );
    },
    [props.navigation.goBack]
  );

  const defaultMeta = useMemo(() => {
    return {
      title: channelQuery.data?.title ?? '',
      description: channelQuery.data?.description ?? '',
      coverImage: channelQuery.data?.coverImage ?? '',
      iconImage: channelQuery.data?.iconImage ?? '',
    };
  }, [channelQuery.data]);

  const handleSubmit = useCallback(
    (meta: db.ClientMeta) => {
      store.updateDMMeta(channelId, meta);
    },
    [channelId]
  );

  return (
    <AttachmentProvider canUpload={canUpload} uploadAsset={uploadAsset}>
      {channelQuery.data ? (
        <MetaEditor
          channel={channelQuery.data}
          defaultValues={defaultMeta}
          renderHeader={renderHeader}
          onSubmit={handleSubmit}
        />
      ) : null}
    </AttachmentProvider>
  );
}

type RenderHeaderParams = {
  submit: () => void;
};

type MetaEditorProps = {
  defaultValues: {
    title: string;
    description: string;
    coverImage: string;
    iconImage: string;
  };
  onSubmit: (meta: db.ClientMeta) => void;
  renderHeader: (params: RenderHeaderParams) => JSX.Element;
  group?: db.Group;
  channel?: db.Channel;
};

function MetaEditor({
  defaultValues,
  onSubmit,
  renderHeader,
  group,
  channel,
}: MetaEditorProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm({
    defaultValues,
  });

  const triggerSubmit = useCallback(() => {
    handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  return (
    <View backgroundColor="$background" flex={1}>
      <YStack justifyContent="space-between" width="100%" height="100%">
        {renderHeader({ submit: triggerSubmit })}
        <KeyboardAvoidingView style={{ flex: 1 }}>
          <YStack gap="$2xl" padding="$xl" alignItems="center" flex={1}>
            <EditablePofileImages
              group={group}
              channel={channel}
              onSetCoverUrl={(url) => setValue('coverImage', url)}
              onSetIconUrl={(url) => setValue('iconImage', url)}
            />
            <YStack gap="$m" width="100%">
              <FormInput
                name="title"
                label="Group Name"
                control={control}
                errors={errors}
                rules={{ required: 'Group name is required' }}
                placeholder="Group Name"
              />
              <FormInput
                name="description"
                label="Group Description"
                control={control}
                errors={errors}
                placeholder="Group Description"
              />
            </YStack>
          </YStack>
        </KeyboardAvoidingView>
      </YStack>
    </View>
  );
}
