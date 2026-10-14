import type { ConnectionStatus } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import { capitalize } from '../utils';
import AttachmentSheet from './AttachmentSheet';
import { useImageInput } from './Form';
import { IconEditor, editorAvatar, imageMenuItems } from './IconEditor';
import { ListItem } from './ListItem';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
  SettingsListScreenView,
} from './SettingsList';
import WayfindingNotice from './Wayfinding/Notices';

interface MetaEditorScreenViewProps {
  title: string;
  onSubmit: (meta: db.ClientMeta) => void;
  goBack: () => void;
  chat?: db.Group | db.Channel | null;
  currentUserId: string;
  /** For a group: whether its host can be reached, which saving needs. */
  hostStatus?: ConnectionStatus;
}

const maxTitleLength = 30;
const maxDescriptionLength = 300;

/** Edits a group's or a group chat's name, icon and description. */
export function MetaEditorScreenView(props: MetaEditorScreenViewProps) {
  // The fields start from the chat's values, so they wait for the chat.
  return <MetaEditorForm key={props.chat?.id ?? 'loading'} {...props} />;
}

function MetaEditorForm({
  title: screenTitle,
  goBack,
  onSubmit,
  chat,
  currentUserId,
  hostStatus,
}: MetaEditorScreenViewProps) {
  const isWindowNarrow = useIsWindowNarrow();
  const [initial] = useState(() => getMetaWithDefaults(chat));
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [iconImage, setIconImage] = useState(initial.iconImage);
  const icon = useImageInput({
    value: iconImage || undefined,
    onChange: (uri) => setIconImage(uri ?? ''),
  });

  const group = chat && logic.isGroup(chat) ? chat : null;
  const channel = chat && !group ? (chat as db.Channel) : null;
  const label = group ? 'group' : 'chat';
  const hostReachable =
    !hostStatus || (hostStatus.complete && hostStatus.status === 'yes');
  // A picked image is a local file until its upload finishes.
  const iconReady = !/^(file|data)/.test(iconImage);
  const isDirty =
    title !== initial.title ||
    description !== initial.description ||
    iconImage !== initial.iconImage;
  const canSave = hostReachable && iconReady && isDirty;

  const handleSave = useCallback(() => {
    if (canSave) {
      onSubmit({
        title,
        description,
        coverImage: initial.coverImage,
        iconImage,
      });
    }
  }, [canSave, description, iconImage, initial.coverImage, onSubmit, title]);

  // The icon as it will look once saved: the picked image, or the fallback
  // drawn from the name as it is typed.
  const preview = { title, iconImage: icon.assetUri ?? null };
  const avatar = group ? (
    <ListItem.GroupIcon
      model={{ ...group, ...preview }}
      size="custom"
      width={editorAvatar.size}
      height={editorAvatar.size}
      borderRadius={editorAvatar.radius}
      membersBackgroundColor="$background"
    />
  ) : channel ? (
    <ListItem.ChannelIcon
      model={{ ...channel, ...preview }}
      size="custom"
      width={editorAvatar.size}
      height={editorAvatar.size}
      borderRadius={editorAvatar.radius}
    />
  ) : null;
  const sections: SettingsSectionModel[] = [
    {
      key: 'icon',
      rows: [],
      element: (
        <IconEditor
          avatar={avatar}
          isUploading={icon.isUploading}
          menuItems={imageMenuItems(icon, 'Remove Icon')}
          onPressFallback={icon.toggleSheet}
          accessibilityLabel="Change icon"
          notice={
            group && logic.isPersonalGroup(group, currentUserId) ? (
              <WayfindingNotice.CustomizeGroup />
            ) : null
          }
        />
      ),
    },
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
            placeholder: `${capitalize(label)} name`,
            maxLength: maxTitleLength,
            capitalization: 'words',
          },
          testID: 'GroupTitleInput',
        },
      ],
    },
    {
      key: 'description',
      footer: hostReachable
        ? undefined
        : hostStatus?.complete
          ? 'The group’s host is offline, so changes can’t be saved right now.'
          : 'Checking the connection to the group’s host…',
      rows: [
        {
          key: 'description',
          title: 'Description',
          textField: {
            value: description,
            onChangeText: setDescription,
            placeholder: `About this ${label}`,
            lines: 5,
            maxLength: maxDescriptionLength,
            capitalization: 'sentences',
          },
          testID: 'GroupDescriptionInput',
        },
      ],
    },
  ];

  return (
    <SettingsListScreenView
      title={screenTitle}
      sections={sections}
      loading={!chat}
      onBackPressed={goBack}
      showsBackOnWideWindows
      useHorizontalTitleLayout={!isWindowNarrow}
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      rightActions={[
        {
          id: 'MetaEditorSaveButton',
          text: 'Save',
          tint: '$positiveActionText',
          disabled: !canSave,
          onPress: handleSave,
          testID: 'MetaEditorSaveButton',
        },
      ]}
    >
      {/* Web picks from this sheet; removing is in the menu. */}
      <AttachmentSheet {...icon.sheetProps} showClearOption={false} />
    </SettingsListScreenView>
  );
}

export function getMetaWithDefaults(
  chat: db.Group | db.Channel | null | undefined,
  defaults = {
    title: '',
    description: '',
    coverImage: '',
    iconImage: '',
  }
) {
  return {
    title: chat?.title || defaults.title,
    description: chat?.description || defaults.description,
    coverImage: chat?.coverImage || defaults.coverImage,
    iconImage: chat?.iconImage || defaults.iconImage,
  };
}
