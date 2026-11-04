import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as api from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import * as store from '@tloncorp/shared/store';
import { useCopy, useToast } from '@tloncorp/ui';
import { triggerHaptic } from '@tloncorp/ui';
import { Button } from '@tloncorp/ui';
import { Icon, type IconType } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import {
  ComponentProps,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ScrollView,
  View,
  XStack,
  YStack,
  getTokenValue,
  isWeb,
  styled,
  useTheme,
} from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import { useContact, useCurrentUserId } from '../contexts/appDataContext';
import { useNavigation as useContextNavigation } from '../contexts/navigation';
import { useGroupTitle } from '../utils';
import { ContactAvatar } from './Avatar';
import { useHasBotPromptFiles, useIsOwnedBot } from './BotSystemPrompts';
import { ContactName } from './ContactNameV2';
import { GroupAvatar } from './GroupAvatar';
import { ListItem } from './ListItem';
import {
  PhoneAttestDisplay,
  TwitterAttestDisplay,
} from './Profile/ConnectedAccountsWidget';
import { WidgetPane } from './WidgetPane';
import { useBoundHandler } from './listItems/listItemUtils';

interface Props {
  userId: string;
  connectionStatus: api.ConnectionStatus | null;
  onPressBotSettings?: () => void;
  /** Present on the owner's bot when it can show its scheduled tasks. */
  onPressScheduledTasks?: () => void;
  scheduledTaskCount?: number;
  /** Shown only for a bot whose prompt files our ship mirrors. */
  onPressPromptFiles?: () => void;
  onPressGroup: (group: db.Group) => void;
  onPressUserProfile: (userId: string) => void;
}

export function UserProfileScreenView(props: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();
  const userContact = useContact(props.userId);
  const hasPromptFiles = useHasBotPromptFiles(props.userId);
  const ownerId = api.getBotOwnerId(props.userId);
  const botId = api.getBotUserIdForUser(props.userId);
  // Every planet has a would-be Tlonbot @p; only show one we know exists.
  const botContact = useContact(botId);
  const isOwnProfile = currentUserId === props.userId;
  const isBot = domain.isBotContact({
    id: props.userId,
    botInfo: userContact?.botInfo,
  });
  const { data: sharedGroups } = store.useSharedGroups({
    contactId: isOwnProfile ? undefined : props.userId,
  });
  const pinnedGroups = useMemo(() => {
    return (
      userContact?.pinnedGroups?.flatMap((g) => (g.group ? [g.group] : [])) ??
      []
    );
  }, [userContact?.pinnedGroups]);

  const attestations = useMemo(() => {
    return (userContact?.attestations
      ?.map((a) => a.attestation)
      .filter(Boolean) ?? []) as db.Attestation[];
  }, [userContact]);

  const twitterAttestation = useMemo(() => {
    return attestations.find(
      (a) => a.type === 'twitter' && a.status === 'verified'
    );
  }, [attestations]);

  const phoneAttestation = useMemo(() => {
    return attestations.find(
      (a) => a.type === 'phone' && a.status === 'verified'
    );
  }, [attestations]);

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

  const showsBotSettings =
    !!props.onPressBotSettings || !!props.onPressScheduledTasks;
  // In-app bot settings list the prompt files under Advanced. The web opens
  // hosting's settings instead, which don't.
  const promptFilesInSettings = !!props.onPressBotSettings && !isWeb;

  return (
    <View flex={1} backgroundColor={theme.secondaryBackground.val}>
      <ScrollView
        flex={1}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 600,
          marginHorizontal: 'auto',
          paddingBottom: insets.bottom + getTokenValue('$3xl'),
        }}
      >
        <ProfileHeader
          userId={props.userId}
          ownerId={ownerId}
          isBot={isBot}
          hasNickname={!!userContact?.nickname?.length}
        />

        {!isOwnProfile ? (
          <View marginTop="$3xl">
            <ProfileButtons userId={props.userId} contact={userContact} />
          </View>
        ) : null}

        <YStack marginTop="$2xl" gap="$l" paddingHorizontal="$xl">
          {ownerId ? (
            <OwnerRow
              ownerId={ownerId}
              isYours={ownerId === currentUserId}
              onPress={props.onPressUserProfile}
            />
          ) : null}

          {isBot ? <BotStatusCard contactId={props.userId} /> : null}

          {showsBotSettings ? (
            <BotSettingsCard
              onPressBotSettings={props.onPressBotSettings}
              onPressScheduledTasks={props.onPressScheduledTasks}
              scheduledTaskCount={props.scheduledTaskCount}
            />
          ) : null}

          {/* Data-gated rather than riding the hosted-bot check: our steward
              only mirrors prompt files for bots that configured us as their
              owner (including a self-owned bot on this very ship), so the
              mirror is itself the ownership signal. Where the settings card
              opens the app's bot settings, they are reached from there. */}
          {!promptFilesInSettings &&
          props.onPressPromptFiles &&
          hasPromptFiles ? (
            <ProfileLinkItem
              icon="ChannelNote"
              title="Prompt files"
              testID="BotPromptFilesButton"
              onPress={props.onPressPromptFiles}
            />
          ) : null}

          {userContact?.status ? (
            <StatusDisplay status={userContact.status} />
          ) : null}
          <BioDisplay bio={userContact?.bio ?? ''} />

          {!ownerId && botContact ? (
            <BotsCard botId={botId} onPress={props.onPressUserProfile} />
          ) : null}

          <XStack gap="$l" width="100%" flexWrap="wrap">
            {twitterAttestation && (
              <View width="48%" flexGrow={1} height={120}>
                <TwitterAttestDisplay attestation={twitterAttestation} />
              </View>
            )}

            {phoneAttestation && (
              <View width="48%" flexGrow={1} height={120}>
                <PhoneAttestDisplay attestation={phoneAttestation} />
              </View>
            )}

            <View width="48%" flexGrow={1} height={120}>
              <StatusBlock status={nodeStatus} label="Node" />
            </View>

            <View width="48%" flexGrow={1} height={120}>
              <StatusBlock status={sponsorStatus} label="Sponsor" />
            </View>
          </XStack>

          <PinnedGroupsList groups={pinnedGroups} onPressGroup={onPressGroup} />

          {sharedGroups?.length ? (
            <GroupsListCard
              title={`In ${sharedGroups.length} of your workspaces`}
              groups={sharedGroups}
              onPressGroup={onPressGroup}
              testID="ProfileSharedGroups"
            />
          ) : null}
        </YStack>
      </ScrollView>
    </View>
  );
}

/** The name under the avatar ends with this when the profile is a bot's. */
function BotTag({ onCard }: { onCard?: boolean }) {
  return (
    <View
      // On the page it is a white chip; inside a white card, a gray one.
      backgroundColor={onCard ? '$secondaryBackground' : '$background'}
      borderRadius="$m"
      paddingHorizontal="$m"
      paddingVertical="$2xs"
      flexShrink={0}
      testID="ProfileBotTag"
    >
      <Text size="$label/s" color="$secondaryText">
        Bot
      </Text>
    </View>
  );
}

function OwnerRow({
  ownerId,
  isYours,
  onPress,
}: {
  ownerId: string;
  isYours: boolean;
  onPress: (contactId: string) => void;
}) {
  const handlePress = useCallback(() => {
    onPress(ownerId);
    triggerHaptic('baseButtonClick');
  }, [onPress, ownerId]);

  return (
    <Pressable
      borderRadius="$2xl"
      onPress={handlePress}
      testID="ProfileOwnerCard"
    >
      <XStack
        alignItems="center"
        gap="$l"
        paddingVertical="$xl"
        paddingHorizontal="$2xl"
        borderRadius="$2xl"
        backgroundColor="$background"
      >
        <ContactAvatar contactId={ownerId} size="$4xl" />
        <YStack flex={1} minWidth={0} gap="$m">
          {isYours ? (
            <Text size="$label/l">This is your bot</Text>
          ) : (
            <Text size="$label/l" numberOfLines={1}>
              <ContactName contactId={ownerId} expandLongIds />
            </Text>
          )}
          <Text size="$label/m" color="$secondaryText">
            {isYours ? 'Only you can change how it works' : 'Owns this bot'}
          </Text>
        </YStack>
        {isYours ? null : <Icon type="ChevronRight" color="$tertiaryText" />}
      </XStack>
    </Pressable>
  );
}

function botVersionLabel(contact: db.Contact | null | undefined) {
  const info = domain.parseBotInfo(contact?.botInfo);
  return info ? `Tlonbot ${info.version}` : null;
}

/**
 * Whether the bot says it is running. Bots publish only online or offline, so
 * these are the two states shown.
 */
function BotStatusCard({ contactId }: { contactId: string }) {
  const contact = useContact(contactId);
  const liveness = domain.botLivenessOf(contact);
  const version = botVersionLabel(contact);
  if (!liveness && !version) {
    return null;
  }
  return (
    <PaddedBlock testID="ProfileBotStatus">
      <XStack justifyContent="space-between" alignItems="center">
        <Text size="$body" color="$tertiaryText">
          Status
        </Text>
        {version ? (
          <Text size="$label/s" color="$secondaryText">
            {version}
          </Text>
        ) : null}
      </XStack>
      {liveness ? (
        <XStack
          gap="$xs"
          padding="$xs"
          borderRadius="$2xl"
          backgroundColor="$secondaryBackground"
        >
          <StatusSegment label="Offline" active={liveness === 'offline'} />
          <StatusSegment label="Online" active={liveness === 'online'} />
        </XStack>
      ) : null}
    </PaddedBlock>
  );
}

function StatusSegment({ label, active }: { label: string; active: boolean }) {
  return (
    <XStack
      flex={1}
      height="$3.5xl"
      borderRadius="$xl"
      alignItems="center"
      justifyContent="center"
      gap="$s"
      backgroundColor={active ? '$primaryText' : 'transparent'}
    >
      {active ? (
        <View
          width={6}
          height={6}
          borderRadius={3}
          backgroundColor={
            label === 'Online' ? '$positiveActionText' : '$tertiaryText'
          }
        />
      ) : null}
      <Text
        size="$label/m"
        color={active ? '$background' : '$tertiaryText'}
        accessibilityState={{ selected: active }}
      >
        {label}
      </Text>
    </XStack>
  );
}

/**
 * The owner's bot settings at a glance. Model and connections are the values
 * the bot settings screen last loaded; a row shows once there is one.
 */
function BotSettingsCard({
  onPressBotSettings,
  onPressScheduledTasks,
  scheduledTaskCount,
}: {
  onPressBotSettings?: () => void;
  onPressScheduledTasks?: () => void;
  scheduledTaskCount?: number;
}) {
  const currentUserId = useCurrentUserId();
  const summary = db.botSettingsSummary.useValue();
  const remembered =
    summary && summary.ship === currentUserId.replace(/^~/, '')
      ? summary
      : null;

  const rows: {
    key: string;
    title: string;
    value?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }[] = [];
  if (onPressBotSettings && remembered?.models) {
    rows.push({
      key: 'model',
      title: 'Model',
      value: remembered.models,
      onPress: onPressBotSettings,
    });
  }
  if (onPressScheduledTasks) {
    rows.push({
      key: 'tasks',
      title: 'Scheduled tasks',
      value: (
        <XStack alignItems="center" gap="$s">
          <Icon type="Clock" size="$m" color="$primaryText" />
          {scheduledTaskCount !== undefined ? (
            <Text size="$body">{scheduledTaskCount}</Text>
          ) : null}
        </XStack>
      ),
      onPress: onPressScheduledTasks,
      testID: 'ScheduledTasksButton',
    });
  }
  if (onPressBotSettings && remembered?.connections) {
    rows.push({
      key: 'connections',
      title: 'Connections',
      value: remembered.connections,
      onPress: onPressBotSettings,
    });
  }

  return (
    <PaddedBlock gap="$s" paddingBottom="$l" testID="ProfileBotSettings">
      <XStack justifyContent="space-between" alignItems="center">
        <Text size="$body" color="$tertiaryText">
          Bot settings
        </Text>
        {onPressBotSettings ? (
          <Pressable
            onPress={() => {
              onPressBotSettings();
              triggerHaptic('baseButtonClick');
            }}
            testID="BotSettingsButton"
          >
            <XStack alignItems="center" gap="$xs">
              <Text size="$label/m" color="$secondaryText">
                Open
              </Text>
              <Icon type="ChevronRight" size="$s" color="$tertiaryText" />
            </XStack>
          </Pressable>
        ) : null}
      </XStack>
      <YStack>
        {rows.map((row, i) => (
          <Pressable
            key={row.key}
            onPress={
              row.onPress
                ? () => {
                    row.onPress?.();
                    triggerHaptic('baseButtonClick');
                  }
                : undefined
            }
            testID={row.testID}
          >
            <XStack
              minHeight="$4xl"
              alignItems="center"
              justifyContent="space-between"
              gap="$l"
              borderTopWidth={i === 0 ? 0 : 1}
              borderColor="$border"
            >
              <Text size="$body" color="$secondaryText">
                {row.title}
              </Text>
              {typeof row.value === 'string' ? (
                <Text size="$body" numberOfLines={1} flexShrink={1}>
                  {row.value}
                </Text>
              ) : (
                row.value
              )}
            </XStack>
          </Pressable>
        ))}
      </YStack>
    </PaddedBlock>
  );
}

/** A person's own bot, linked from their profile. */
function BotsCard({
  botId,
  onPress,
}: {
  botId: string;
  onPress: (contactId: string) => void;
}) {
  const botContact = useContact(botId);
  const version = botVersionLabel(botContact);
  const handlePress = useCallback(() => {
    onPress(botId);
    triggerHaptic('baseButtonClick');
  }, [botId, onPress]);

  return (
    <Pressable
      borderRadius="$2xl"
      onPress={handlePress}
      testID="ProfileTlonbotCard"
    >
      <PaddedBlock>
        <Text size="$body" color="$tertiaryText">
          Bots
        </Text>
        <XStack alignItems="center" gap="$l">
          <ContactAvatar contactId={botId} size="$4xl" />
          <YStack flex={1} minWidth={0} gap="$m">
            <XStack alignItems="center" gap="$s">
              <Text size="$label/l" numberOfLines={1} flexShrink={1}>
                <ContactName contactId={botId} />
              </Text>
              <BotTag onCard />
            </XStack>
            {version ? (
              <Text size="$label/m" color="$secondaryText">
                {version}
              </Text>
            ) : null}
          </YStack>
          <Icon type="ChevronRight" color="$tertiaryText" />
        </XStack>
      </PaddedBlock>
    </Pressable>
  );
}

function PinnedGroupsList({
  groups,
  onPressGroup,
}: {
  groups: db.Group[];
  onPressGroup: (group: db.Group) => void;
}) {
  const pinnedGroupsKey = useMemo(() => {
    return groups.map((g) => g.id).join(',');
  }, [groups]);

  useEffect(() => {
    if (pinnedGroupsKey.length) {
      store.syncGroupPreviews(pinnedGroupsKey.split(','));
    }
  }, [pinnedGroupsKey]);

  if (!groups.length) {
    return null;
  }
  return (
    <GroupsListCard
      title="Pinned workspaces"
      groups={groups}
      onPressGroup={onPressGroup}
      testID="ProfilePinnedGroups"
    />
  );
}

function GroupsListCard({
  title,
  groups,
  onPressGroup,
  testID,
}: {
  title: string;
  groups: db.Group[];
  onPressGroup: (group: db.Group) => void;
  testID?: string;
}) {
  return (
    <YStack
      borderRadius="$2xl"
      backgroundColor="$background"
      paddingTop="$2xl"
      paddingBottom="$s"
      testID={testID}
    >
      <Text
        size="$body"
        color="$tertiaryText"
        paddingHorizontal="$2xl"
        paddingBottom="$s"
      >
        {title}
      </Text>
      {groups.map((group, i) => (
        <GroupListRow
          key={group.id}
          model={group}
          first={i === 0}
          onPress={onPressGroup}
        />
      ))}
    </YStack>
  );
}

function GroupListRow({
  model,
  first,
  onPress,
}: {
  model: db.Group;
  first: boolean;
  onPress: (group: db.Group) => void;
}) {
  const handlePress = useBoundHandler(model, onPress);
  const title = useGroupTitle(model);
  return (
    <Pressable onPress={handlePress}>
      {first ? null : (
        <View
          height={1}
          marginLeft={getTokenValue('$2xl') + getTokenValue('$4xl') + 12}
          backgroundColor="$border"
        />
      )}
      <XStack
        alignItems="center"
        gap="$l"
        paddingHorizontal="$2xl"
        paddingVertical="$m"
      >
        <GroupAvatar model={model} size="$4xl" />
        <Text size="$label/l" flex={1} numberOfLines={1}>
          {title}
        </Text>
      </XStack>
    </Pressable>
  );
}

function ProfileLinkItem({
  icon,
  title,
  value,
  testID,
  onPress,
}: {
  icon: IconType;
  title: string;
  value?: string;
  testID?: string;
  onPress: () => void;
}) {
  const handlePress = useCallback(() => {
    onPress();
    triggerHaptic('baseButtonClick');
  }, [onPress]);

  return (
    <View width="100%">
      <Pressable
        borderRadius="$2xl"
        onPress={handlePress}
        pressStyle={{ backgroundColor: '$secondaryBackground' }}
        testID={testID}
      >
        <ListItem
          alignItems="center"
          backgroundColor="$background"
          borderRadius="$2xl"
          padding="$l"
        >
          <ListItem.SystemIcon icon={icon} rounded />
          <ListItem.MainContent>
            <ListItem.Title>{title}</ListItem.Title>
          </ListItem.MainContent>
          {value ? (
            <Text size="$label/l" color="$tertiaryText">
              {value}
            </Text>
          ) : null}
          <ListItem.SystemIcon
            icon="ChevronRight"
            backgroundColor="$transparent"
          />
        </ListItem>
      </Pressable>
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
  return (
    <PaddedBlock flex={1} padding="$2xl" gap="$2xl">
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

export const PaddedBlock = styled(YStack, {
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
    <WidgetPane borderRadius="$2xl" padding="$2xl" width="100%" {...rest}>
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
    <WidgetPane borderRadius="$2xl" padding="$2xl" width="100%" {...rest}>
      <WidgetPane.Title>Status</WidgetPane.Title>
      <Text size="$body" trimmed={false}>
        {status}
      </Text>
    </WidgetPane>
  );
}

function ProfileHeader(props: {
  userId: string;
  ownerId: string | null;
  isBot: boolean;
  hasNickname: boolean;
}) {
  const { doCopy } = useCopy(props.userId);
  const showToast = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const contact = useContact(props.userId);

  const handleCopy = useCallback(() => {
    doCopy();
    triggerHaptic('success');
    showToast({ message: 'Copied!', duration: 1500 });
  }, [doCopy, showToast]);

  const handleAvatarPress = useCallback(() => {
    if (contact?.avatarImage) {
      navigation.navigate('MediaViewer', {
        mediaType: 'image',
        uri: contact.avatarImage,
      });
      triggerHaptic('baseButtonClick');
    }
  }, [navigation, contact?.avatarImage]);

  const primaryNameProps = props.hasNickname
    ? { mode: 'nickname' as const, color: '$primaryText' }
    : { mode: 'contactId' as const };

  return (
    <YStack alignItems="center" paddingTop="$l" paddingHorizontal="$xl">
      <View position="relative">
        <Pressable
          onPress={handleAvatarPress}
          accessibilityLabel={`Profile avatar color ${contact?.color ?? 'default'}`}
          testID="ProfileAvatar"
        >
          <View {...avatarShadow}>
            <ContactAvatar contactId={props.userId} size="$9xl" />
          </View>
        </Pressable>
        {props.ownerId ? (
          // The owner, tucked on the bot's avatar. The owner row below names
          // them; this keeps who is behind the bot in view with the bot.
          <View
            position="absolute"
            right={-getTokenValue('$m')}
            bottom={-getTokenValue('$m')}
            padding="$xs"
            borderRadius="$l"
            backgroundColor="$secondaryBackground"
            testID="ProfileOwnerBadge"
          >
            <ContactAvatar contactId={props.ownerId} size="$3xl" />
          </View>
        ) : null}
      </View>
      <Pressable
        marginTop="$xl"
        maxWidth="100%"
        onPress={handleCopy}
        alignItems="center"
      >
        <XStack alignItems="center" gap="$s" maxWidth="100%">
          <ContactName
            contactId={props.userId}
            fontSize={28}
            lineHeight={34}
            numberOfLines={1}
            color="$primaryText"
            flexShrink={1}
            minWidth={0}
            {...primaryNameProps}
          />
          {props.isBot ? <BotTag /> : null}
        </XStack>
        {props.hasNickname ? (
          <Text size="$label/l" color="$secondaryText" marginTop="$xs">
            <ContactName
              contactId={props.userId}
              mode="contactId"
              expandLongIds
            />
          </Text>
        ) : null}
      </Pressable>
    </YStack>
  );
}

// A small lift under the header avatar, the one shadow on the screen.
const avatarShadow = {
  borderRadius: '$xl',
  shadowColor: '#000000',
  shadowOpacity: 0.14,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
} as const;

function ProfileButtons(props: { userId: string; contact: db.Contact | null }) {
  const navContext = useContextNavigation();
  const queryClient = db.queryClient;
  const currentUserId = useCurrentUserId();
  // Blocking your own bot makes no sense; hide the button on an owned
  // bot's profile. Unblock stays reachable so an already-blocked bot
  // can't get stranded.
  const { isOwnedBot, isPending: isOwnedBotPending } = useIsOwnedBot(
    props.userId
  );
  const isCurrentUsersBot = api.isBotUserIdForUser(props.userId, currentUserId);

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

  const handleBlock = useCallback(async () => {
    if (props.contact && props.contact.isBlocked) {
      await store.unblockUser(props.userId);
    } else {
      await store.blockUser(props.userId);
    }
    queryClient.invalidateQueries({
      queryKey: [['contact', props.userId]],
    });
  }, [props, queryClient]);

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        paddingLeft={'$xl'}
      >
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
        {isBlocked ||
        (!isOwnedBot && !isCurrentUsersBot && !isOwnedBotPending) ? (
          <ProfileButton
            title={isBlocked ? 'Unblock' : 'Block'}
            onPress={handleBlock}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

export function ProfileButton({
  title,
  onPress,
  hero,
  ...props
}: {
  title: string;
  onPress?: () => void;
  hero?: boolean;
} & ComponentProps<typeof Button.Frame>) {
  const handlePress = useCallback(() => {
    onPress?.();
    triggerHaptic('baseButtonClick');
  }, [onPress]);

  const color = hero ? '$primaryText' : '$background';

  return (
    <Button.Frame
      flex={1}
      borderRadius="$2xl"
      onPress={handlePress}
      backgroundColor={color}
      borderColor={color}
      marginHorizontal="$xs"
      {...props}
    >
      <Button.Text
        color={hero ? '$background' : '$primaryText'}
        whiteSpace="nowrap"
        trimmed={false}
      >
        {title}
      </Button.Text>
    </Button.Frame>
  );
}
