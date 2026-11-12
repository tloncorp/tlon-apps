import { useEffect, useState } from 'react';
import { YStack } from 'tamagui';

import { BrowserCard } from '../features/browser/BrowserCard';
import { BrowserCredentialHandoffContext } from '../features/browser/BrowserCredentialHandoffContext';
import type { BrowserPreview } from '../features/browser/browserPreview';
import { rememberBrowserPreview } from '../features/browser/browserPreviewCache';
import { FixtureWrapper } from './FixtureWrapper';

const noop = () => {};
// An open viewer pauses preview polling, so each card keeps the state it is
// given below and makes no network requests.
const handoff = {
  viewerOpen: true,
  openForm: noop,
  openViewer: async () => {},
  register: () => '',
  resolve: () => undefined,
  discard: noop,
};

function SessionCard({
  id,
  preview,
}: {
  id: string;
  preview?: BrowserPreview;
}) {
  const viewerUrl = `https://browser-session.tlon.network/s/${id}.signature`;
  const [ready, setReady] = useState(!preview);
  useEffect(() => {
    if (!preview) return;
    void rememberBrowserPreview(viewerUrl, preview).then(() => setReady(true));
  }, [preview, viewerUrl]);
  return (
    <FixtureWrapper fillWidth>
      <BrowserCredentialHandoffContext.Provider value={handoff}>
        <YStack padding="$l">
          {ready ? (
            <BrowserCard
              card={{ type: 'browser-session', version: 1, viewerUrl }}
              allowed
            />
          ) : null}
        </YStack>
      </BrowserCredentialHandoffContext.Provider>
    </FixtureWrapper>
  );
}

export default {
  Loading: <SessionCard id="fixture-loading" />,
  Credentials: (
    <SessionCard id="fixture-credentials" preview={{ status: 'protected' }} />
  ),
  Unavailable: (
    <SessionCard id="fixture-unavailable" preview={{ status: 'unavailable' }} />
  ),
  Ended: <SessionCard id="fixture-ended" preview={{ status: 'ended' }} />,
};
