// tamagui-ignore
import SystemNotices from '../ui/components/SystemNotices';
import { FixtureWrapper } from './FixtureWrapper';

export default {
  BasicExample: (
    <FixtureWrapper fillWidth>
      <SystemNotices.NoticeFrame gap="$2xl">
        <SystemNotices.NoticeTitle>Example Notices</SystemNotices.NoticeTitle>
        <SystemNotices.NoticeBody>
          This is a description of the system notice you are viewing.
        </SystemNotices.NoticeBody>
      </SystemNotices.NoticeFrame>
    </FixtureWrapper>
  ),
  JoinRequest: (
    <FixtureWrapper fillWidth>
      <SystemNotices.JoinRequestNotice
        onDismiss={() => {}}
        onViewRequests={() => {}}
      />
    </FixtureWrapper>
  ),
};
