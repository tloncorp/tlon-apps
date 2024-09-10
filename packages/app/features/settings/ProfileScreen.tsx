import { NavBarView, ProfileScreenView, View } from '@tloncorp/ui';
import { useCallback } from 'react';

import { useDMLureLink } from '../../hooks/useBranchLink';
import { useCurrentUserId } from '../../hooks/useCurrentUser';

export default function ProfileScreen({
  navigateToAppSettings,
  navigateToEditProfile,
  navigateToErrorReport,
  navigateToProfile,
  navigateToHome,
  navigateToNotifications,
  navigateToSettings,
  handleLogout,
}: {
  navigateToAppSettings: () => void;
  navigateToEditProfile: () => void;
  navigateToErrorReport: () => void;
  navigateToProfile: (userId: string) => void;
  navigateToHome: () => void;
  navigateToNotifications: () => void;
  navigateToSettings: () => void;
  handleLogout?: () => void;
}) {
  const currentUserId = useCurrentUserId();

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
        currentUserId={currentUserId}
        onAppSettingsPressed={onAppSettingsPressed}
        onEditProfilePressed={onEditProfilePressed}
        onLogoutPressed={() => {
          if (handleLogout) {
            handleLogout();
          }
        }}
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
