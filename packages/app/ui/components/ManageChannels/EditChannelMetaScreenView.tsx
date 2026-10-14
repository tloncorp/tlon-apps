import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../SettingsList';

interface EditChannelMetaScreenViewProps {
  onGoBack: () => void;
  isLoading: boolean;
  channel?: db.Channel | null;
  group?: db.Group | null;
  onSubmit: (title: string, description?: string) => void;
}

const maxTitleLength = 30;
const maxDescriptionLength = 300;

export function EditChannelMetaScreenView(
  props: EditChannelMetaScreenViewProps
) {
  // The fields start from the channel's values, so they wait for the channel.
  return <ChannelMetaForm key={props.channel?.id ?? 'loading'} {...props} />;
}

function ChannelMetaForm({
  onGoBack,
  isLoading,
  onSubmit,
  channel,
  group,
}: EditChannelMetaScreenViewProps) {
  const isWindowNarrow = useIsWindowNarrow();
  const [title, setTitle] = useState(channel?.title || '');
  const [description, setDescription] = useState(channel?.description || '');
  const isValid = title.length > 0;
  const isDirty =
    title !== (channel?.title || '') ||
    description !== (channel?.description || '');

  const handleSave = useCallback(() => {
    if (isValid) {
      onSubmit(title, description || undefined);
    }
  }, [description, isValid, onSubmit, title]);

  const sections: SettingsSectionModel[] = [
    // The placeholders say what each field is, as in Contacts.
    {
      key: 'title',
      rows: [
        {
          key: 'title',
          title: 'Name',
          textField: {
            value: title,
            onChangeText: setTitle,
            placeholder: 'Channel name',
            maxLength: maxTitleLength,
            capitalization: 'sentences',
          },
          testID: 'ChannelTitleInput',
        },
      ],
    },
    {
      key: 'description',
      rows: [
        {
          key: 'description',
          title: 'Description',
          textField: {
            value: description,
            onChangeText: setDescription,
            placeholder: 'About this channel',
            lines: 5,
            maxLength: maxDescriptionLength,
            capitalization: 'sentences',
          },
          testID: 'ChannelDescriptionInput',
        },
      ],
    },
  ];

  return (
    <SettingsListScreenView
      title="Edit channel info"
      subtitle={
        channel?.title && group?.title
          ? `${group.title}: ${channel.title}`
          : undefined
      }
      sections={sections}
      loading={!channel}
      loadingSubtitle={isLoading ? 'Loading…' : null}
      onBackPressed={onGoBack}
      showsBackOnWideWindows
      useHorizontalTitleLayout={!isWindowNarrow}
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      rightActions={[
        {
          id: 'ChannelSettingsSaveButton',
          text: 'Save',
          tint: '$positiveActionText',
          disabled: !isValid || !isDirty,
          onPress: handleSave,
          testID: 'ChannelSettingsSaveButton',
        },
      ]}
    />
  );
}
