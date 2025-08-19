import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useMemo, useState } from 'react';
import { useCallback } from 'react';
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
import { useConnectionStatus } from './useConnectionStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

const logger = createDevLogger('UserProfileScreen', false);

export function UserProfileScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { params } = route;
  const isWindowNarrow = useIsWindowNarrow();
  const { performGroupAction } = useGroupActions();
  const currentUserId = useCurrentUserId();
  const userId = params?.userId || currentUserId;
  const { data: contacts } = store.useContacts();
  const connectionStatus = useConnectionStatus(userId);
  const { data: calmSettings } = store.useCalmSettings();
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);
  const { resetToDm } = useRootNavigation();

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
              useHorizontalTitleLayout={!isWindowNarrow}
              leftControls={
                shouldShowBackButton ? (
                  <ScreenHeader.BackButton
                    onPress={() => navigation.goBack()}
                  />
                ) : null
              }
              rightControls={
                canEdit ? (
                  <ScreenHeader.IconButton
                    onPress={handlePressEdit}
                    testID="ContactEditButton"
                    type="Draw"
                  />
                ) : null
              }
            />
            <UserProfileScreenView
              userId={userId}
              connectionStatus={connectionStatus}
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
