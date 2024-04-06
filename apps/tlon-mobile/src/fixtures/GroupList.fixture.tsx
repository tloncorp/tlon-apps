import type * as db from '@tloncorp/shared/dist/db';
import { GroupList } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import {
  groupWithColorAndNoImage,
  groupWithImage,
  groupWithLongTitle,
  groupWithNoColorOrImage,
  groupWithSvgImage,
} from './fakeData';

export default {
  basic: (
    <FixtureWrapper fillWidth>
      <GroupList
        pinned={[groupWithLongTitle, groupWithImage] as db.Group[]}
        other={
          [
            groupWithColorAndNoImage,
            groupWithImage,
            groupWithSvgImage,
            groupWithNoColorOrImage,
          ] as db.Group[]
        }
      />
    </FixtureWrapper>
  ),
  emptyPinned: (
    <FixtureWrapper fillWidth>
      <GroupList
        pinned={[]}
        other={
          [
            groupWithColorAndNoImage,
            groupWithImage,
            groupWithSvgImage,
            groupWithNoColorOrImage,
          ] as db.Group[]
        }
      />
    </FixtureWrapper>
  ),
  loading: (
    <FixtureWrapper fillWidth>
      <GroupList pinned={[]} other={[]} />
    </FixtureWrapper>
  ),
};
