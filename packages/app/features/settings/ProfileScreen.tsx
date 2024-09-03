import * as store from '@tloncorp/shared/dist/store';
import { NavBarView, ProfileScreenView, View } from '@tloncorp/ui';
import { useCallback } from 'react';

import { useDMLureLink } from '../../hooks/useBranchLink';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useHandleLogout } from '../../hooks/useHandleLogout';

export default function ProfileScreen({
  navigateToAppSettings,
  navigateToEditProfile,
  navigateToErrorReport,
  navigateToProfile,
  navigateToHome,
  navigateToNotifications,
  navigateToSettings,
}: {
  navigateToAppSettings: () => void;
  navigateToEditProfile: () => void;
  navigateToErrorReport: () => void;
  navigateToProfile: (userId: string) => void;
  navigateToHome: () => void;
  navigateToNotifications: () => void;
  navigateToSettings: () => void;
}) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();
  const handleLogout = useHandleLogout();

  const onAppSettingsPressed = useCallback(() => {
    navigateToAppSettings();
  }, [navigateToAppSettings]);

  const onEditProfilePressed = useCallback(() => {
    navigateToEditProfile();
  }, [navigateToEditProfile]);

  const onSendBugReportPressed = useCallback(() => {
    navigateToErrorReport();
  }, [navigateToErrorReport]);

  const onViewProfilePressed = useCallback(() => {
    navigateToProfile(currentUserId);
  }, [currentUserId, navigateToProfile]);

  const { dmLink } = useDMLureLink();

  return (
    <View backgroundColor="$background" flex={1}>
      <ProfileScreenView
        contacts={contacts ?? []}
        currentUserId={currentUserId}
        onAppSettingsPressed={onAppSettingsPressed}
        onEditProfilePressed={onEditProfilePressed}
        onLogoutPressed={handleLogout}
        onSendBugReportPressed={onSendBugReportPressed}
        onViewProfile={onViewProfilePressed}
        dmLink={dmLink}
      />
      <NavBarView
        navigateToHome={() => {
          navigateToHome();
        }}
        navigateToNotifications={() => {
          navigateToNotifications();
        }}
        navigateToProfile={() => {
          navigateToSettings();
        }}
        currentRoute="Profile"
        currentUserId={currentUserId}
      />
    </View>
  );
}
