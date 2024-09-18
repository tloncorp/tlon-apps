import { NavBarView, ProfileScreenView, View } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';

import { useDMLureLink } from '../../hooks/useBranchLink';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { getHostingToken, getHostingUserId } from '../../utils/hosting';

export default function ProfileScreen({
  navigateToEditProfile,
  navigateToErrorReport,
  navigateToContactProfile,
  navigateToHome,
  navigateToNotifications,
  navigateToProfileSettings,
  navigateToBlockedUsers,
  navigateToManageAccount,
  navigateToAppInfo,
  navigateToNotificationSettings,
  handleLogout,
}: {
  navigateToEditProfile: () => void;
  navigateToErrorReport: () => void;
  navigateToContactProfile: (userId: string) => void;
  navigateToHome: () => void;
  navigateToNotifications: () => void;
  navigateToProfileSettings: () => void;
  navigateToAppInfo?: () => void;
  navigateToNotificationSettings: () => void;
  navigateToBlockedUsers: () => void;
  navigateToManageAccount: () => void;
  handleLogout?: () => void;
}) {
  const currentUserId = useCurrentUserId();
  const { dmLink } = useDMLureLink();
  const hasHostedAuth = useHasHostedAuth();

  const handleViewProfile = useCallback(() => {
    navigateToContactProfile(currentUserId);
  }, [currentUserId, navigateToContactProfile]);

  return (
    <View backgroundColor="$background" flex={1}>
      <ProfileScreenView
        hasHostedAuth={hasHostedAuth}
        currentUserId={currentUserId}
        onEditProfilePressed={navigateToEditProfile}
        onLogoutPressed={handleLogout}
        onSendBugReportPressed={navigateToErrorReport}
        onAppInfoPressed={navigateToAppInfo}
        onNotificationSettingsPressed={navigateToNotificationSettings}
        onBlockedUsersPressed={navigateToBlockedUsers}
        onManageAccountPressed={navigateToManageAccount}
        onViewProfile={handleViewProfile}
        dmLink={dmLink}
      />
      <NavBarView
        navigateToHome={navigateToHome}
        navigateToNotifications={navigateToNotifications}
        navigateToProfileSettings={navigateToProfileSettings}
        currentRoute="Profile"
        currentUserId={currentUserId}
      />
    </View>
  );
}

function useHasHostedAuth() {
  const [hasHostedAuth, setHasHostedAuth] = useState(false);

  useEffect(() => {
    async function getHostingInfo() {
      const [cookie, userId] = await Promise.all([
        getHostingToken(),
        getHostingUserId(),
      ]);
      if (cookie && userId) {
        setHasHostedAuth(true);
      }
    }
    getHostingInfo();
  }, []);

  return hasHostedAuth;
}
