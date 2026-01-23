import { YStack } from 'tamagui';

import SystemNotices from '../ui/components/SystemNotices';
import { FixtureWrapper } from './FixtureWrapper';

function NotificationsPromptFixture() {
  return (
    <FixtureWrapper fillWidth safeArea={false}>
      <YStack padding="$l">
        <SystemNotices.NoticeFrame>
          <YStack gap="$5xl">
            <YStack gap="$xl">
              <SystemNotices.NoticeTitle>
                Enable notifications
              </SystemNotices.NoticeTitle>
              <SystemNotices.NoticeBody>
                Tlon Messenger works best if you enable push notifications on
                your device.
              </SystemNotices.NoticeBody>
            </YStack>
            <SystemNotices.JoinRequestNotice
              onViewRequests={() => console.log('View requests')}
              onDismiss={() => console.log('Dismiss')}
            />
          </YStack>
        </SystemNotices.NoticeFrame>
      </YStack>
    </FixtureWrapper>
  );
}

function JoinRequestNoticeFixture() {
  return (
    <FixtureWrapper fillWidth safeArea={false}>
      <YStack padding="$l">
        <SystemNotices.JoinRequestNotice
          onViewRequests={() => console.log('View requests')}
          onDismiss={() => console.log('Dismiss')}
        />
      </YStack>
    </FixtureWrapper>
  );
}

export default {
  'Join Request Notice': <JoinRequestNoticeFixture />,
  'Notifications Prompt (Static)': <NotificationsPromptFixture />,
};
