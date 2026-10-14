import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import {
  getNicknameErrorMessage,
  validateNickname,
} from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { ConfirmDialog, Pressable, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { View, XStack, getTokenValue } from 'tamagui';

import { useContact, useCurrentUserId } from '../contexts/appDataContext';
import { useGroups } from '../contexts/groups';
import { useAlphabeticallySegmentedGroups } from '../hooks/groupsSorters';
import AttachmentSheet from './AttachmentSheet';
import { ContactAvatar } from './Avatar';
import { avatarColorPresets, useImageInput } from './Form';
import { GroupSelectorSheet } from './GroupSelectorSheet';
import { IconEditor, editorAvatar, imageMenuItems } from './IconEditor';
import { ListItem } from './ListItem';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsRowModel,
  type SettingsSectionModel,
  SettingsListScreenView,
} from './SettingsList';

interface Props {
  userId: string;
  onGoBack: () => void;
  onGoToAttestation?: (type: 'twitter' | 'phone') => void;
}

const maxNicknameLength = 30;
const maxStatusLength = 50;
const maxBioLength = 300;
const maxPinnedGroups = 5;

/**
 * Edits your own profile, or the nickname and avatar you give someone else.
 */
export function EditProfileScreenView(props: Props) {
  const userContact = useContact(props.userId);
  // The fields start from the contact, so they start again once it loads.
  return (
    <EditProfileForm
      key={`${props.userId}-${userContact ? 'loaded' : 'empty'}`}
      {...props}
      userContact={userContact}
    />
  );
}

function EditProfileForm({
  userId,
  userContact,
  onGoBack,
  onGoToAttestation,
}: Props & { userContact: db.Contact | null | undefined }) {
  const isWindowNarrow = useIsWindowNarrow();
  const currentUserId = useCurrentUserId();
  const isCurrUser = userId === currentUserId;
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  // Someone else's nickname and avatar here are the ones you give them.
  const [initial] = useState(() => ({
    nickname:
      (isCurrUser ? userContact?.nickname : userContact?.customNickname) ?? '',
    avatarImage:
      (isCurrUser
        ? userContact?.avatarImage
        : userContact?.customAvatarImage) ?? '',
    status: userContact?.status ?? '',
    bio: userContact?.bio ?? '',
    sigilColor: userContact?.color ?? '',
  }));
  const [nickname, setNickname] = useState(initial.nickname);
  const [status, setStatus] = useState(initial.status);
  const [bio, setBio] = useState(initial.bio);
  const [sigilColor, setSigilColor] = useState(initial.sigilColor);
  const [avatarImage, setAvatarImage] = useState(initial.avatarImage);
  const avatar = useImageInput({
    value: avatarImage || undefined,
    onChange: (uri) => setAvatarImage(uri ?? ''),
  });

  const nicknameError = useMemo(() => {
    if (!isCurrUser) {
      return null;
    }
    const result = validateNickname(nickname, currentUserId);
    return result.isValid ? null : getNicknameErrorMessage(result.errorType);
  }, [currentUserId, isCurrUser, nickname]);
  // A picked image is a local file until its upload finishes.
  const avatarReady = !/^(file|data)/.test(avatarImage);
  const isDirty =
    nickname !== initial.nickname ||
    status !== initial.status ||
    bio !== initial.bio ||
    sigilColor !== initial.sigilColor ||
    avatarImage !== initial.avatarImage;
  const canSave = !nicknameError && avatarReady && isDirty;

  const handleSave = useCallback(() => {
    if (!canSave) {
      return;
    }
    if (isDirty) {
      // An emptied field clears what was set; one never set stays unset.
      const nicknameUpdate = nickname || (initial.nickname ? null : undefined);
      const avatarUpdate =
        avatarImage || (initial.avatarImage ? null : undefined);
      if (isCurrUser) {
        store.updateCurrentUserProfile({
          status,
          bio,
          nickname: nicknameUpdate,
          avatarImage: avatarUpdate,
        });
        if (sigilColor !== initial.sigilColor) {
          store.updateSigilColor(sigilColor || null);
        }
      } else {
        store.updateContactMetadata(userId, {
          nickname: nicknameUpdate,
          avatarImage: avatarUpdate,
        });
      }
    }
    onGoBack();
  }, [
    avatarImage,
    bio,
    canSave,
    initial,
    isCurrUser,
    isDirty,
    nickname,
    onGoBack,
    sigilColor,
    status,
    userId,
  ]);

  const handleBack = useCallback(() => {
    if (isDirty) {
      setDiscardDialogOpen(true);
    } else {
      onGoBack();
    }
  }, [isDirty, onGoBack]);

  const pinned = usePinnedGroups(userContact);

  const preview = (
    <ContactAvatar
      contactId={userId}
      contactOverride={{
        ...(userContact ?? { id: userId }),
        id: userId,
        // Someone without a picture of yours shows the one they chose.
        avatarImage:
          avatar.assetUri ??
          (isCurrUser ? null : (userContact?.peerAvatarImage ?? null)),
        color: (isCurrUser ? sigilColor : userContact?.color) || null,
      }}
      size="custom"
      width={editorAvatar.size}
      height={editorAvatar.size}
      borderRadius={editorAvatar.radius}
      ignoreCalm
    />
  );

  const sections: SettingsSectionModel[] = [
    {
      key: 'avatar',
      rows: [],
      element: (
        <IconEditor
          avatar={preview}
          isUploading={avatar.isUploading}
          menuItems={imageMenuItems(avatar, 'Remove Photo')}
          onPressFallback={avatar.toggleSheet}
          accessibilityLabel="Change avatar image"
        >
          {isCurrUser ? (
            <AvatarColorDots value={sigilColor} onChange={setSigilColor} />
          ) : null}
        </IconEditor>
      ),
    },
    // Short fields share a card and are labelled by their placeholders, as in
    // Contacts; the long bio gets its own.
    {
      key: 'about',
      footer:
        nicknameError ??
        (isCurrUser
          ? `Shown in place of ${userId}.`
          : `Only you see this. Shown in place of ${userContact?.peerNickname || userId}.`),
      rows: [
        {
          key: 'nickname',
          title: 'Nickname',
          textField: {
            value: nickname,
            onChangeText: setNickname,
            placeholder: 'Nickname',
            maxLength: maxNicknameLength,
            capitalization: 'words',
          },
          testID: 'ProfileNicknameInput',
        },
        ...(isCurrUser
          ? [
              {
                key: 'status',
                title: 'Status',
                textField: {
                  value: status,
                  onChangeText: setStatus,
                  placeholder: 'Status',
                  maxLength: maxStatusLength,
                  capitalization: 'sentences' as const,
                },
                testID: 'ProfileStatusInput',
              },
            ]
          : []),
      ],
    },
    ...(isCurrUser
      ? ([
          {
            key: 'bio',
            rows: [
              {
                key: 'bio',
                title: 'Bio',
                textField: {
                  value: bio,
                  onChangeText: setBio,
                  placeholder: 'Bio',
                  lines: 5,
                  maxLength: maxBioLength,
                  capitalization: 'sentences',
                },
                testID: 'ProfileBioInput',
              },
            ],
          },
          {
            key: 'pinned',
            title: 'Pinned groups',
            footer: `Shown on your profile, up to ${maxPinnedGroups}.`,
            rows: [
              ...pinned.groups.map(
                (group): SettingsRowModel => ({
                  ...groupRow(group),
                  value: 'Remove',
                  accessory: 'none',
                  onPress: () => pinned.toggle(group),
                  testID: 'ProfilePinnedGroupRemove',
                })
              ),
              {
                key: 'add',
                title:
                  pinned.groups.length > 0 ? 'Choose groups' : 'Add a group',
                action: true,
                onPress: pinned.openSelector,
                testID: 'ProfilePinnedGroupsAdd',
              },
            ],
          },
          {
            key: 'attestations',
            title: 'Connected accounts',
            rows: [
              attestationRow(
                'twitter',
                '𝕏 Account',
                userContact,
                onGoToAttestation
              ),
              attestationRow('phone', 'Phone', userContact, onGoToAttestation),
            ],
          },
        ] satisfies SettingsSectionModel[])
      : ([
          ...(userContact?.bio
            ? [
                {
                  key: 'bio',
                  title: 'Bio',
                  rows: [
                    { key: 'bio', title: userContact.bio, expanded: true },
                  ],
                },
              ]
            : []),
          ...(pinned.groups.length
            ? [
                {
                  key: 'pinned',
                  title: 'Pinned groups',
                  rows: pinned.groups.map(groupRow),
                },
              ]
            : []),
        ] satisfies SettingsSectionModel[])),
  ];

  return (
    <SettingsListScreenView
      title="Edit profile"
      sections={sections}
      onBackPressed={handleBack}
      showsBackOnWideWindows
      useHorizontalTitleLayout={!isWindowNarrow}
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      rightActions={[
        {
          id: 'ProfileSaveButton',
          text: 'Save',
          tint: '$positiveActionText',
          disabled: !canSave,
          onPress: handleSave,
          testID: 'ProfileSaveButton',
        },
      ]}
    >
      {/* Web picks from this sheet; removing is in the menu. */}
      <AttachmentSheet {...avatar.sheetProps} showClearOption={false} />
      <GroupSelectorSheet
        open={pinned.selectorOpen}
        onOpenChange={pinned.setSelectorOpen}
        alphaSegmentedGroups={pinned.choices}
        selected={pinned.groups.map((g) => g.id)}
        onSelect={pinned.toggle}
        onClose={() => pinned.setSelectorOpen(false)}
        title="Pinned groups"
        subtitle={
          pinned.groups.length >= maxPinnedGroups
            ? `No more groups can be selected (max ${maxPinnedGroups})`
            : `Choose up to ${maxPinnedGroups - pinned.groups.length} more groups`
        }
      />
      <ConfirmDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to discard them?"
        confirmText="Discard"
        destructive
        onConfirm={() => {
          setDiscardDialogOpen(false);
          onGoBack();
        }}
      />
    </SettingsListScreenView>
  );
}

/**
 * The groups shown on a profile. Your own save as soon as they change, as
 * they always have; the rest of the form waits for Save.
 */
function usePinnedGroups(contact: db.Contact | null | undefined) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [pinned, setPinned] = useState<db.Group[]>(
    () =>
      (contact?.pinnedGroups
        ?.map((pin) => pin.group)
        .filter(Boolean) as db.Group[]) ?? []
  );
  const allGroups = useGroups();
  const choices = useAlphabeticallySegmentedGroups({
    groups:
      allGroups?.filter(
        (g) => g.privacy !== 'secret' && g.currentUserIsMember === true
      ) ?? [],
    enabled: true,
  });
  // Shown as they are now, where the group is still around.
  const groups = useMemo(
    () => pinned.map((g) => allGroups?.find((p) => p.id === g.id) ?? g),
    [pinned, allGroups]
  );

  const toggle = useCallback(
    (group: db.Group) => {
      const next = pinned.some((g) => g.id === group.id)
        ? pinned.filter((g) => g.id !== group.id)
        : pinned.length < maxPinnedGroups
          ? [...pinned, group]
          : null;
      if (next) {
        setPinned(next);
        store.updateProfilePinnedGroups(next);
      }
    },
    [pinned]
  );

  return {
    groups,
    choices,
    toggle,
    selectorOpen,
    setSelectorOpen,
    openSelector: () => setSelectorOpen(true),
  };
}

function groupRow(group: db.Group): SettingsRowModel {
  return {
    key: group.id,
    title: group.title || 'Untitled group',
    leading: {
      kind: 'element',
      render: ({ size }) => (
        <View>
          <ListItem.GroupIcon
            model={group}
            size="custom"
            width={size}
            height={size}
            borderRadius={size * 0.25}
          />
        </View>
      ),
    },
  };
}

function attestationRow(
  type: 'twitter' | 'phone',
  title: string,
  contact: db.Contact | null | undefined,
  onPress: Props['onGoToAttestation']
): SettingsRowModel {
  const attestation = contact?.attestations
    ?.map((a) => a.attestation)
    .find((a) => a?.type === type);
  const handle = attestation?.value
    ? type === 'twitter'
      ? `@${attestation.value}`
      : domain.displayablePhoneNumber(attestation.value)
    : undefined;
  return {
    key: type,
    title,
    subtitle: handle,
    value: attestation
      ? attestation.status === 'verified'
        ? 'Verified'
        : 'In progress'
      : undefined,
    onPress: onPress ? () => onPress(type) : undefined,
    testID: `ProfileAttestation-${type}`,
  };
}

const dotSize = 26;

/** The default avatar's color, as a row of dots under the avatar. */
function AvatarColorDots({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <XStack justifyContent="center" gap="$s" flexWrap="wrap">
      {avatarColorPresets.map(([name, token]) => {
        const color = getTokenValue(token, 'color');
        const selected = value === color;
        return (
          <Pressable
            key={color}
            // Choosing the chosen color goes back to the default.
            onPress={() => onChange(selected ? '' : color)}
            testID={`ProfileColorSwatch-${color.slice(1)}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`Profile avatar color ${name}`}
          >
            <View
              width={dotSize + 6}
              height={dotSize + 6}
              borderRadius={(dotSize + 6) / 2}
              borderWidth={2}
              borderColor={selected ? '$primaryText' : 'transparent'}
              alignItems="center"
              justifyContent="center"
            >
              <View
                width={dotSize}
                height={dotSize}
                borderRadius={dotSize / 2}
                backgroundColor={color}
                borderWidth={1}
                borderColor="$shadow"
              />
            </View>
          </Pressable>
        );
      })}
    </XStack>
  );
}
