import { FixtureWrapper } from '@tloncorp/app/fixtures/FixtureWrapper';
import { DeskOutdatedScreen } from '@tloncorp/app/features/DeskOutdatedScreen';

export default {
  'Desk outdated — version reported': (
    <FixtureWrapper safeArea={false}>
      <DeskOutdatedScreen
        currentVersion="12.1.0"
        minimumVersion="12.2.0"
        shipName="~palfun-foslup"
        onRetry={() => {}}
        onLogout={async () => undefined}
      />
    </FixtureWrapper>
  ),
  'Desk outdated — retrying': (
    <FixtureWrapper safeArea={false}>
      <DeskOutdatedScreen
        currentVersion="12.1.0"
        minimumVersion="12.2.0"
        isProbing
        onRetry={() => {}}
        onLogout={async () => undefined}
      />
    </FixtureWrapper>
  ),
  'Desk outdated — no version reported': (
    <FixtureWrapper safeArea={false}>
      <DeskOutdatedScreen
        currentVersion={null}
        minimumVersion="12.2.0"
        onRetry={() => {}}
      />
    </FixtureWrapper>
  ),
};
