import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo, useState } from 'react';
import { UseFormReturn, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ScrollView,
  View,
  XStack,
  YStack,
  styled,
  useWindowDimensions,
} from 'tamagui';

import { useContact, useCurrentUserId, useNavigation } from '../contexts';
import { useCopy } from '../hooks/useCopy';
import { triggerHaptic } from '../utils';
import { ContactAvatar, GroupAvatar } from './Avatar';
import { Button } from './Button';
import { ContactName } from './ContactNameV2';
import { ControlledImageField, ControlledTextField, FormFrame } from './Form';
import { Icon } from './Icon';
import { ScreenHeader } from './ScreenHeader';
import { Text } from './TextV2';
import { WidgetPane } from './WidgetPane';

interface Props {
  userId: string;
  onBack: () => void;
  connectionStatus: api.ConnectionStatus | null;
  onPressGroup: (group: db.Group) => void;
  onPressEdit: () => void;
}

export function UserProfileScreenView(props: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const insets = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();
  const userContact = useContact(props.userId);
  const pinnedGroups = useMemo(() => {
    return (
      userContact?.pinnedGroups?.flatMap((g) => (g.group ? [g.group] : [])) ??
      []
    );
  }, [userContact?.pinnedGroups]);

  const windowDimensions = useWindowDimensions();

  const nodeStatus = !props.connectionStatus?.complete
    ? 'pending'
    : props.connectionStatus.status === 'yes'
      ? 'online'
      : 'offline';

  const sponsorStatus = !props.connectionStatus?.complete
    ? 'pending'
    : props.connectionStatus.status === 'yes'
      ? 'online'
      : ['no-their-galaxy', 'no-sponsor-miss', 'no-sponsor-hit'].includes(
            props.connectionStatus.status
          )
        ? 'offline'
        : 'online';

  const onPressGroup = useCallback(
    (group: db.Group) => {
      props.onPressGroup(group);
    },
    [props]
  );

  const editForm = useForm({
    mode: 'onChange',
    defaultValues: {
      nickname: userContact?.customNickname ?? userContact?.nickname ?? '',
      avatarImage: userContact?.avatarImage ?? undefined,
    },
  });

  const shouldShowEditButton = useMemo(
    () => currentUserId === props.userId || userContact?.isContact,
    [currentUserId, props.userId, userContact]
  );

  const handleEditPress = useCallback(() => {
    if (currentUserId === props.userId) {
      props.onPressEdit();
    } else {
      setIsEditing(true);
    }
  }, [currentUserId, props]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSaveEdit = useCallback(() => {
    const startNickname = userContact?.customNickname ?? userContact?.nickname;
    const startAvatar =
      userContact?.customAvatarImage ?? userContact?.avatarImage;

    const addedNickname = editForm.getValues('nickname');
    const addedAvatar = editForm.getValues('avatarImage');

    const updatedMetadata = {
      nickname: addedNickname !== startNickname ? addedNickname : undefined,
      avatarImage: addedAvatar !== startAvatar ? addedAvatar : undefined,
    };

    store.updateContactMetadata(props.userId, updatedMetadata);

    setIsEditing(false);

    setTimeout(() => {
      editForm.reset();
    }, 100);
  }, [
    editForm,
    props.userId,
    userContact?.avatarImage,
    userContact?.customAvatarImage,
    userContact?.customNickname,
    userContact?.nickname,
  ]);

  return (
    <View flex={1} backgroundColor={'$secondaryBackground'}>
      <ScreenHeader
        title="Profile"
        leftControls={
          isEditing ? (
            <ScreenHeader.TextButton onPress={handleCancelEdit}>
              Cancel
            </ScreenHeader.TextButton>
          ) : (
            <ScreenHeader.BackButton onPress={props.onBack} />
          )
        }
        rightControls={
          isEditing ? (
            <ScreenHeader.TextButton
              onPress={handleSaveEdit}
              disabled={!editForm.formState.isDirty}
            >
              Save
            </ScreenHeader.TextButton>
          ) : shouldShowEditButton ? (
            <ScreenHeader.TextButton onPress={handleEditPress}>
              Edit
            </ScreenHeader.TextButton>
          ) : null
        }
      />
      <ScrollView
        flex={1}
        contentContainerStyle={{
          padding: '$l',
          gap: '$l',
          paddingBottom: insets.bottom,
          flexWrap: 'wrap',
          flexDirection: 'row',
        }}
      >
        {isEditing ? (
          <EditUserInfoRow
            form={editForm}
            defaultNickname={userContact?.nickname ?? props.userId}
          />
        ) : (
          <UserInfoRow
            userId={props.userId}
            hasNickname={!!userContact?.nickname?.length}
          />
        )}

        {userContact?.status && <View width="100%"></View>}

        <View
          flex={1}
          gap="$l"
          flexWrap="wrap"
          flexDirection="row"
          // opacity={0.3}
        >
          {currentUserId !== props.userId ? (
            <ProfileButtons userId={props.userId} contact={userContact} />
          ) : null}
          <BioDisplay bio={userContact?.bio ?? ''} />

          <StatusBlock status={nodeStatus} label="Node" />
          <StatusBlock status={sponsorStatus} label="Sponsor" />

          {pinnedGroups.map((group, i) => {
            return (
              <PaddedBlock
                alignItems="center"
                key={group.id}
                width={i === 0 ? '100%' : (windowDimensions.width - 36) / 2}
                onPress={() => onPressGroup(group)}
              >
                <GroupAvatar model={group} size="$4xl" />
                <YStack gap="$m" alignItems="center">
                  <Text size="$label/s" textAlign="center">
                    {group.title}
                  </Text>

                  {i === 0 && (
                    <Text
                      size="$label/s"
                      textAlign="center"
                      color="$tertiaryText"
                      maxWidth={150}
                      numberOfLines={3}
                    >
                      {group.description}
                    </Text>
                  )}
                </YStack>
              </PaddedBlock>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function StatusBlock({
  status,
  label,
}: {
  status: 'online' | 'offline' | 'pending';
  label: string;
}) {
  const windowDimensions = useWindowDimensions();

  return (
    <PaddedBlock
      padding="$2xl"
      width={(windowDimensions.width - 36) / 2}
      gap="$2xl"
    >
      <XStack width="100%" justifyContent="space-between">
        <Text size="$body" color="$tertiaryText">
          {label}
        </Text>
        <Text size="$body">{statusText(status)}</Text>
      </XStack>
      <StatusIndicator status={status} label={label} />
    </PaddedBlock>
  );
}

function statusText(status: 'online' | 'offline' | 'pending') {
  return status === 'online'
    ? 'Online'
    : status === 'offline'
      ? 'Offline'
      : 'Pending';
}

function StatusIndicator({
  label,
  status,
}: {
  label: string;
  status: 'online' | 'offline' | 'pending';
  children?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <View
      width="$3xl"
      height="$3xl"
      borderRadius={label === 'Sponsor' ? '$xs' : 100}
      alignItems="center"
      justifyContent="center"
      backgroundColor={
        status === 'online'
          ? '$positiveActionText'
          : status === 'offline'
            ? '$negativeActionText'
            : '$secondaryText'
      }
    >
      {status === 'pending' ? (
        <Text color="$background" size="$body">
          ?
        </Text>
      ) : (
        <Icon
          type={status === 'offline' ? 'Stop' : 'Record'}
          size="$s"
          color="$background"
        />
      )}
    </View>
  );
}

const PaddedBlock = styled(YStack, {
  borderRadius: '$2xl',
  padding: '$2xl',
  gap: '$l',
  justifyContent: 'center',
  backgroundColor: '$background',
});

export function BioDisplay({ bio }: { bio: string }) {
  return bio.length ? (
    <WidgetPane borderRadius={'$2xl'} padding="$2xl" width="100%">
      <WidgetPane.Title>About</WidgetPane.Title>
      <Text size="$body" trimmed={false}>
        {bio}
      </Text>
    </WidgetPane>
  ) : null;
}

function UserInfoRow(props: { userId: string; hasNickname: boolean }) {
  const { didCopy, doCopy } = useCopy(props.userId);

  const handleCopy = useCallback(() => {
    doCopy();
    triggerHaptic('success');
  }, [doCopy]);

  return (
    <XStack
      alignItems="center"
      onPress={handleCopy}
      padding="$l"
      gap="$xl"
      width={'100%'}
    >
      <ContactAvatar contactId={props.userId} size="$5xl" />
      <YStack flex={1} justifyContent="center">
        {props.hasNickname ? (
          <>
            <ContactName
              contactId={props.userId}
              mode="nickname"
              fontSize={24}
              lineHeight={24}
              maxWidth="100%"
              numberOfLines={1}
            />
            <XStack alignItems="center">
              <ContactName
                contactId={props.userId}
                color="$secondaryText"
                mode="contactId"
              />
              {didCopy ? (
                <Icon
                  type="Checkmark"
                  customSize={[14, 14]}
                  position="relative"
                  top={1}
                />
              ) : null}
            </XStack>
          </>
        ) : (
          <ContactName fontSize={24} lineHeight={24} contactId={props.userId} />
        )}
      </YStack>
    </XStack>
  );
}

function EditUserInfoRow(props: {
  form: UseFormReturn<{ nickname: string; avatarImage: string | undefined }>;
  defaultNickname: string;
}) {
  return (
    <FormFrame width="100%">
      <ControlledImageField
        name="avatarImage"
        label="Avatar"
        control={props.form.control}
        hideError={true}
        rules={{
          pattern: {
            value: /^(?!file).+/,
            message: 'Image has not finished uploading',
          },
        }}
      />
      <ControlledTextField
        name="nickname"
        label="Nickname"
        control={props.form.control}
        inputProps={{ placeholder: props.defaultNickname }}
        rules={{
          maxLength: {
            value: 30,
            message: 'Your nickname is limited to 30 characters',
          },
        }}
      />
    </FormFrame>
  );
}

function ProfileButtons(props: { userId: string; contact: db.Contact | null }) {
  const navContext = useNavigation();
  const handleMessageUser = useCallback(() => {
    navContext.onPressGoToDm?.([props.userId]);
  }, [navContext, props.userId]);

  const handleBlock = useCallback(() => {
    if (props.contact && props.contact.isBlocked) {
      store.unblockUser(props.userId);
    } else {
      store.blockUser(props.userId);
    }
  }, [props]);

  const handleToggleContact = useCallback(() => {
    if (props.contact && props.contact.isContact) {
      store.removeContact(props.userId);
    } else {
      store.addContact(props.userId);
    }
  }, [props]);

  const isBlocked = useMemo(() => {
    return props.contact?.isBlocked ?? false;
  }, [props.contact]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <ProfileButton title="Message" onPress={handleMessageUser} hero />
      <ProfileButton
        title={props.contact?.isContact ? 'Remove Contact' : 'Add Contact'}
        onPress={handleToggleContact}
      />
      <ProfileButton
        title={isBlocked ? 'Unblock' : 'Block'}
        onPress={handleBlock}
      />
    </ScrollView>
  );
}

function ProfileButton(props: {
  title: string;
  onPress: () => void;
  hero?: boolean;
}) {
  return (
    <Button
      flexGrow={1}
      flexBasis={1}
      borderWidth={0}
      paddingVertical={'$xl'}
      paddingHorizontal="$2xl"
      borderRadius="$2xl"
      onPress={props.onPress}
      hero={props.hero}
      marginHorizontal="$m"
    >
      <Text
        size="$label/xl"
        color={props.hero ? '$background' : '$primaryText'}
      >
        {props.title}
      </Text>
    </Button>
  );
}
