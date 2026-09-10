import { exampleContacts } from '@tloncorp/app/fixtures/contentHelpers';
import { FixtureWrapper } from '@tloncorp/app/fixtures/FixtureWrapper';

import { HostingAuthReconnectScreen } from '../screens/HostingAuthReconnectScreen';

const profile = {
  ...exampleContacts.palfun,
  nickname: 'Palfun',
};

export default {
  'Security check — Confirm your OTP': (
    <FixtureWrapper safeArea={false}>
      <HostingAuthReconnectScreen
        profileId={profile.id}
        profile={profile}
        autoRequest={false}
        initialOtpInfo={{
          retryAfter: 0,
          maskedEmail: 'b***@tlon.io',
        }}
        onRequestCode={async () => ({
          retryAfter: 0,
          maskedEmail: 'b***@tlon.io',
        })}
        onVerifyCode={async () => undefined}
        onLogout={async () => undefined}
      />
    </FixtureWrapper>
  ),
  'Security check — Confirm phone OTP': (
    <FixtureWrapper safeArea={false}>
      <HostingAuthReconnectScreen
        profileId={profile.id}
        profile={profile}
        autoRequest={false}
        initialOtpInfo={{
          retryAfter: 0,
          maskedPhoneNumber: '(***) ***-4821',
        }}
        onRequestCode={async () => ({
          retryAfter: 0,
          maskedPhoneNumber: '(***) ***-4821',
        })}
        onVerifyCode={async () => undefined}
        onLogout={async () => undefined}
      />
    </FixtureWrapper>
  ),
};
