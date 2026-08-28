import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/api';
import { AnalyticsEvent, createDevLogger, trackEvent } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, isWeb, useTheme } from 'tamagui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupActions } from '../../hooks/useGroupActions';
import { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  AppDataContextProvider,
  AttachmentProvider,
  GroupPreviewAction,
  GroupPreviewSheet,
  NavigationProvider,
  ScreenHeader,
  UserProfileScreenView,
  useIsWindowNarrow,
} from '../../ui';
import {
  openExternalBotSettings,
  useHasExpectedBotDm,
} from '../../utils/botSettings';
import { useIsOwnedBot } from '../../ui/components/BotSystemPrompts';
import { useShipConnectionStatus } from './useShipConnectionStatus';
import {
  tasksForShip,
  useStewardAutomationTasks,
} from '../automations/useStewardAutomationTasks';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

const logger = createDevLogger('UserProfileScreen', false);

function getCurrentUserIsHostedSafely() {
  try {
    return api.getCurrentUserIsHosted();
  } catch {
    return false;
  }
}

export function UserProfileScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { params } = route;
  const isWindowNarrow = useIsWindowNarrow();
  const { performGroupAction } = useGroupActions();
  const currentUserId = useCurrentUserId();
  const userId = params?.userId || currentUserId;
  const { data: contacts } = store.useContacts();
  const connectionStatus = useShipConnectionStatus(userId);
  const { data: calmSettings } = store.useCalmSettings();
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);
  const { navigateToBotSettings, resetToDm } = useRootNavigation();

  useEffect(() => {
    trackEvent(AnalyticsEvent.ProfileOpened);
  }, [userId]);

  useEffect(() => {
    if (userId && userId !== currentUserId) {
      api.syncUserProfiles([userId]);
    }
  }, [userId, currentUserId]);

  const handleGoToDm = useCallback(
    async (participants: string[]) => {
      resetToDm(participants[0]);
    },
    [resetToDm]
  );

  const handleGroupPreviewSheetOpenChange = useCallback(
    (open: boolean) => {
      setSelectedGroup(open ? selectedGroup : null);
    },
    [selectedGroup]
  );

  const handlePressEdit = useCallback(() => {
    if (isWindowNarrow) {
      navigation.push('EditProfile', { userId });
      return;
    }

    navigation.navigate('EditProfile', { userId });
  }, [isWindowNarrow, navigation, userId]);

  const canUpload = store.useCanUpload();

  const handleGroupAction = useCallback(
    (action: GroupPreviewAction, group: db.Group) => {
      setSelectedGroup(null);
      performGroupAction(action, group);
    },
    [performGroupAction]
  );

  const handlePressGroup = useCallback((group: db.Group) => {
    logger.trackEvent(
      AnalyticsEvent.ActionViewProfileGroup,
      logic.getModelAnalytics({ group })
    );
    setSelectedGroup(group);
  }, []);

  const isOwnBotProfile = useMemo(() => {
    return api.isBotUserIdForUser(userId, currentUserId);
  }, [currentUserId, userId]);
  // isBotUserIdForUser is a naming-convention check, so it excludes a bot
  // that runs on its own ship and named us owner. Use the same data-gated
  // signal the prompts section uses, which treats the presence of an owner
  // mirror as the ownership proof.
  const ownedBotForTasks = useIsOwnedBot(userId).isOwnedBot || isOwnBotProfile;
  const automationQuery = useStewardAutomationTasks(ownedBotForTasks);
  const scheduledTasks = tasksForShip(automationQuery.data, userId);

  const handlePressScheduledTasks = useCallback(() => {
    // Desktop registers these screens in a Drawer, which cannot handle the
    // stack-only PUSH action -- mirror the handlePressEdit branching above.
    if (isWindowNarrow) {
      navigation.push('ScheduledTasks', { botShip: userId });
      return;
    }

    navigation.navigate('ScheduledTasks', { botShip: userId });
  }, [isWindowNarrow, navigation, userId]);

  const isHostedUser = isWeb ? getCurrentUserIsHostedSafely() : false;
  const hasExpectedBotDm = useHasExpectedBotDm(
    currentUserId,
    isWeb && isHostedUser
  );
  // TEMPORARY -- REVERT BEFORE MERGE. The real gate needs a hosted account
  // with the expected bot DM, neither of which a fakeship rig has. Forcing
  // it on makes the row visible for local demos, but it also shows Bot
  // settings to users for whom openExternalBotSettings leads nowhere.
  const shouldShowBotSettingsProfileAction = ownedBotForTasks;

  const handlePressBotSettings = useCallback(() => {
    if (isWeb) {
      openExternalBotSettings();
      return;
    }
    navigateToBotSettings();
  }, [navigateToBotSettings]);

  const canEdit = useMemo(() => {
    return (
      currentUserId === userId ||
      contacts?.find((c) => c.id === userId)?.isContact
    );
  }, [currentUserId, userId, contacts]);

  const shouldShowBackButton = useMemo(() => {
    const isWebDesktop = isWeb && !isWindowNarrow;
    const navHistory = navigation.getState().history;
    const isContactsTabRoot = navHistory?.length === 1;
    // @ts-expect-error - key is a valid property
    const isActivityTab = navHistory?.[0]?.key.includes('ActivityEmpty');
    return !(isWebDesktop && (isContactsTabRoot || isActivityTab));
  }, [isWindowNarrow, navigation]);

  return (
    <AppDataContextProvider
      currentUserId={currentUserId}
      contacts={contacts ?? []}
      calmSettings={calmSettings}
    >
      <NavigationProvider onPressGoToDm={handleGoToDm}>
        <AttachmentProvider
          canUpload={canUpload}
          uploadAsset={store.uploadAsset}
        >
          <View flex={1} backgroundColor={theme.secondaryBackground.val}>
            <ScreenHeader
              title="Profile"
              backgroundColor={theme.secondaryBackground.val}
              useHorizontalTitleLayout={!isWindowNarrow && shouldShowBackButton}
              backAction={
                shouldShowBackButton ? () => navigation.goBack() : undefined
              }
              rightActions={[
                {
                  id: 'edit-profile',
                  icon: 'EditList',
                  label: 'Edit profile',
                  testID: 'ContactEditButton',
                  onPress: handlePressEdit,
                  visible: Boolean(canEdit),
                },
              ]}
              placement="navigation"
            />
            <UserProfileScreenView
              userId={userId}
              connectionStatus={connectionStatus}
              onPressBotSettings={
                shouldShowBotSettingsProfileAction
                  ? handlePressBotSettings
                  : undefined
              }
              onPressScheduledTasks={
                ownedBotForTasks && automationQuery.data?.available
                  ? handlePressScheduledTasks
                  : undefined
              }
              scheduledTaskCount={Object.keys(scheduledTasks).length}
              onPressGroup={handlePressGroup}
            />
          </View>
          <GroupPreviewSheet
            open={selectedGroup !== null}
            onOpenChange={handleGroupPreviewSheetOpenChange}
            group={selectedGroup ?? undefined}
            onActionComplete={handleGroupAction}
          />
        </AttachmentProvider>
      </NavigationProvider>
    </AppDataContextProvider>
  );
}
