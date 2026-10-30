import { BrowserCard } from '../features/browser/BrowserCard';
import { FixtureWrapper } from './FixtureWrapper';

const viewerUrl = 'https://browser-session.tlon.network/s/fixture.signature';

export default {
  browser: (
    <FixtureWrapper fillWidth>
      <BrowserCard
        card={{ type: 'browser-session', version: 1, viewerUrl }}
        allowed={false}
      />
    </FixtureWrapper>
  ),
  vault: (
    <FixtureWrapper fillWidth>
      <BrowserCard
        card={{
          type: 'browser-secure-entry',
          version: 1,
          viewerUrl,
          presentation: { purpose: 'login', site: 'wikipedia.org' },
        }}
        allowed={false}
      />
    </FixtureWrapper>
  ),
};
