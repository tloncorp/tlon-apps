import { KitCard, KitCardData } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';

const bookClub: KitCardData = {
  id: 'book-club',
  publisher: '~sampel-palnet',
  version: '0.1.0',
  name: 'Book Club',
  description: 'A monthly book club with scheduled picks and reminders',
  image: null,
};

const kitFixtures: Record<string, KitCardData> = {
  // the button is always a "Get" CTA (kits are templates — install as many
  // instances as you want); it only changes to a "Runs here" label when the
  // ambient channel's group blob carries this kit, which the cosmos-seeded
  // group doesn't
  default: bookClub,
  withImage: {
    ...bookClub,
    image: 'https://bwyci9wowl3jgy4d.public.blob.vercel-storage.com/groups.png',
  },
  noDescription: {
    ...bookClub,
    description: '',
  },
  longText: {
    ...bookClub,
    name: 'A Kit With A Very Long Name That Should Truncate',
    description:
      'A very long description that goes on and on and should be clamped to a single line inside the card body',
  },
};

export default Object.fromEntries(
  Object.entries(kitFixtures).map(([key, kit]) => [
    key,
    <FixtureWrapper key={key} fillWidth>
      <KitCard kit={kit} margin="$l" />
    </FixtureWrapper>,
  ])
);
