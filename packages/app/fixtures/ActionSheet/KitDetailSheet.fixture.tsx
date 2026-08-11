import * as db from '@tloncorp/shared/db';

import { KitDetailSheet, KitDetailSheetKit } from '../../ui';
import { FixtureWrapper } from '../FixtureWrapper';
import { group } from '../fakeData';

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

const sheetFixtures: Record<
  string,
  { kit: KitDetailSheetKit; contextGroup?: db.Group }
> = {
  // manifest/install queries have no live ship in cosmos, so the CTA
  // renders the not-installed "Get this kit" state
  notInstalled: { kit: bookClub },
  // opened from a kit-made group's details row: "Get your own" (+ "Remove
  // kit" when the viewer is a group admin)
  fromKitGroup: { kit: bookClub, contextGroup: kitGroup },
  sparseCardData: {
    kit: { id: 'book-club', publisher: '~sampel-palnet' },
  },
};

export default Object.fromEntries(
  Object.entries(sheetFixtures).map(([key, { kit, contextGroup }]) => [
    key,
    <FixtureWrapper key={key}>
      <KitDetailSheet
        open={true}
        onOpenChange={() => {}}
        kit={kit}
        contextGroup={contextGroup}
      />
    </FixtureWrapper>,
  ])
);
