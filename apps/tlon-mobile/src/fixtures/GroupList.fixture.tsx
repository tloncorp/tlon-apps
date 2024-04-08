import type * as db from '@tloncorp/shared/dist/db';
import { ChatList } from '@tloncorp/ui';

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
      <ChatList
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
      <ChatList
        pinned={[]}
        unpinned={
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
      <ChatList pinned={[]} unpinned={[]} />
    </FixtureWrapper>
  ),
};
