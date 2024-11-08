import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
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
import { Icon } from './Icon';
import Pressable from './Pressable';
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
  const insets = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();
  const userContact = useContact(props.userId);
  const pinnedGroups = useMemo(() => {
    return (
      userContact?.pinnedGroups?.flatMap((g) => (g.group ? [g.group] : [])) ??
      []
    );
  }, [userContact?.pinnedGroups]);

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

  const canEdit = useMemo(() => {
    return currentUserId === props.userId || userContact?.isContact;
  }, [currentUserId, props.userId, userContact]);

  return (
    <View flex={1} backgroundColor={'$secondaryBackground'}>
      <ScreenHeader
        title="Profile"
        leftControls={<ScreenHeader.BackButton onPress={props.onBack} />}
        rightControls={
          canEdit ? (
            <ScreenHeader.TextButton onPress={() => props.onPressEdit()}>
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
        <UserInfoRow
          userId={props.userId}
          hasNickname={!!userContact?.nickname?.length}
        />
        {userContact?.status && <View width="100%"></View>}

        {currentUserId !== props.userId ? (
          <ProfileButtons userId={props.userId} contact={userContact} />
        ) : null}

        <StatusDisplay status={'Chillin'} />
        <BioDisplay bio={userContact?.bio ?? ''} />

        <StatusBlock status={nodeStatus} label="Node" />
        <StatusBlock status={sponsorStatus} label="Sponsor" />

        <PinnedGroupsDisplay
          groups={pinnedGroups}
          onPressGroup={onPressGroup}
        />
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

export function BioDisplay({
  bio,
  ...rest
}: { bio: string } & ComponentProps<typeof WidgetPane>) {
  return bio.length ? (
    <WidgetPane borderRadius={'$2xl'} padding="$2xl" width="100%" {...rest}>
      <WidgetPane.Title>About</WidgetPane.Title>
      <Text size="$body" trimmed={false}>
        {bio}
      </Text>
    </WidgetPane>
  ) : null;
}

export function StatusDisplay({
  status,
  ...rest
}: { status: string } & ComponentProps<typeof WidgetPane>) {
  return (
    <WidgetPane borderRadius={'$2xl'} padding="$2xl" width="100%" {...rest}>
      <WidgetPane.Title>Status</WidgetPane.Title>
      <Text size="$body">{status}</Text>
    </WidgetPane>
  );
}

export function PinnedGroupsDisplay(
  props: {
    groups: db.Group[];
    onPressGroup: (group: db.Group) => void;
  } & ComponentProps<typeof PaddedBlock>
) {
  const windowDimensions = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(windowDimensions.width);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };

  const { groups, onPressGroup, ...rest } = props;

  if (!props.groups.length) {
    return null;
  }

  return (
    <View
      width="100%"
      flexDirection="row"
      flexWrap="wrap"
      gap="$l"
      onLayout={handleLayout}
    >
      {groups.map((group, i) => {
        return (
          <PaddedBlock
            alignItems="center"
            key={group.id}
            width={i === 0 ? '100%' : (containerWidth - 16) / 2}
            onPress={() => onPressGroup(group)}
            {...rest}
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
  );
}

function UserInfoRow(props: { userId: string; hasNickname: boolean }) {
  const { didCopy, doCopy } = useCopy(props.userId);

  const handleCopy = useCallback(() => {
    doCopy();
    triggerHaptic('success');
  }, [doCopy]);

  return (
    <Pressable width="100%" onPress={handleCopy}>
      <XStack alignItems="center" padding="$l" gap="$xl" width={'100%'}>
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
            <ContactName
              fontSize={24}
              lineHeight={24}
              contactId={props.userId}
            />
          )}
        </YStack>
      </XStack>
    </Pressable>
  );
}

function ProfileButtons(props: { userId: string; contact: db.Contact | null }) {
  const navContext = useNavigation();
  const handleMessageUser = useCallback(() => {
    if (!navContext.onPressGoToDm) {
      console.warn('Navigation context missing onPressGoToDm handler');
      return;
    }

    if (props.contact?.isBlocked) {
      return;
    }

    try {
      navContext.onPressGoToDm([props.userId]);
    } catch (error) {
      console.error('Error navigating to DM:', error);
    }
  }, [navContext, props.userId, props.contact?.isBlocked]);

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

  const handleRemoveContactSuggestion = useCallback(() => {
    store.removeContactSuggestion(props.userId);
  }, [props]);

  const isBlocked = useMemo(() => {
    return props.contact?.isBlocked ?? false;
  }, [props.contact]);

  return (
    <View width="100%">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {!isBlocked && (
          <ProfileButton title="Message" onPress={handleMessageUser} hero />
        )}
        <ProfileButton
          title={props.contact?.isContact ? 'Remove Contact' : 'Add Contact'}
          onPress={handleToggleContact}
        />
        {props.contact?.isContactSuggestion ? (
          <ProfileButton
            title="Clear Suggestion"
            onPress={handleRemoveContactSuggestion}
          />
        ) : null}
        <ProfileButton
          title={isBlocked ? 'Unblock' : 'Block'}
          onPress={handleBlock}
        />
      </ScrollView>
    </View>
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
      marginHorizontal="$xs"
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
