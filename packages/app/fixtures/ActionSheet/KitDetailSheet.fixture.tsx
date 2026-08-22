import type * as api from '@tloncorp/api';
import { queryClient } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useState } from 'react';

import { KitDetailSheet, KitDetailSheetKit } from '../../ui';
import { FixtureWrapper } from '../FixtureWrapper';
import { group, groupWithNoColorOrImage } from '../fakeData';

const bookClub: KitDetailSheetKit = {
  id: 'book-club',
  publisher: '~sampel-palnet',
  version: '0.1.0',
  name: 'Book Club',
  description: 'A monthly book club with scheduled picks and reminders',
  image: null,
};

const kitGroupBlob = JSON.stringify({
  version: 1,
  kits: [
    {
      installId: 'book-club-0',
      kit: {
        id: 'book-club',
        version: '0.1.0',
        publisher: '~sampel-palnet',
      },
      places: { discussion: 'chat/~host/book-club-discussion-1234' },
      schedules: [{ id: 'monthly-pick', cron: '0 17 1 * *' }],
      agents: ['~sampel-palnet'],
      setup: 'done',
      installedAt: 1786149333904,
    },
  ],
});

const kitGroup: db.Group = {
  ...group,
  blob: kitGroupBlob,
};

const makeInstall = (): api.KitInstall => ({
  id: bookClub.id,
  version: '0.1.0',
  publisher: bookClub.publisher,
  places: { discussion: 'chat/~host/book-club-discussion-1234' },
  setup: 'done',
  installed: '~2026.8.22..12.00.00',
});

// keys are group flags; the two live ones match groups seeded into the
// cosmos db, the "deleted" one has no local group row
const liveInstalls: Record<string, api.KitInstall> = {
  [group.id]: makeInstall(),
  [groupWithNoColorOrImage.id]: makeInstall(),
};
const staleInstalls: Record<string, api.KitInstall> = {
  '~nibset-napwyn/deleted-kit-group': makeInstall(),
};

const sheetFixtures: Record<
  string,
  {
    kit: KitDetailSheetKit;
    contextGroup?: db.Group;
    installs?: Record<string, api.KitInstall>;
  }
> = {
  // manifest/install queries have no live ship in cosmos, so the sheet
  // renders with no "Running in" section; the CTA is always "Get this kit"
  notInstalled: { kit: bookClub },
  // two installs of this kit whose groups exist locally: "Running in"
  // lists both, and the CTA stays "Get this kit"
  multiInstall: {
    kit: bookClub,
    installs: { ...liveInstalls, ...staleInstalls },
  },
  // an install whose group was deleted locally is a stale ledger entry —
  // it's filtered out, so no "Running in" section renders at all
  staleInstallOnly: { kit: bookClub, installs: staleInstalls },
  // opened from a kit-made group's details row: same "Get this kit" CTA,
  // plus "Remove kit" when the viewer is a group admin
  fromKitGroup: { kit: bookClub, contextGroup: kitGroup },
  sparseCardData: {
    kit: { id: 'book-club', publisher: '~sampel-palnet' },
  },
};

function SeededKitDetailSheet({
  kit,
  contextGroup,
  installs,
}: {
  kit: KitDetailSheetKit;
  contextGroup?: db.Group;
  installs?: Record<string, api.KitInstall>;
}) {
  // seed the install ledger before first render; the live query errors in
  // cosmos (no ship), which leaves the seeded data in place
  useState(() => {
    queryClient.setQueryData(['kitInstalls'], installs ?? {});
  });
  return (
    <KitDetailSheet
      open={true}
      onOpenChange={() => {}}
      kit={kit}
      contextGroup={contextGroup}
    />
  );
}

export default Object.fromEntries(
  Object.entries(sheetFixtures).map(([key, props]) => [
    key,
    <FixtureWrapper key={key}>
      <SeededKitDetailSheet {...props} />
    </FixtureWrapper>,
  ])
);
