import * as db from '@tloncorp/shared/db';

import { GroupPreviewSheet } from '../../ui';
import { FixtureWrapper } from '../FixtureWrapper';
import { group } from '../fakeData';

const groupFixtures: Record<string, db.Group> = {
  joined: {
    ...group,
    currentUserIsMember: true,
  },
  joining: {
    ...group,
    currentUserIsMember: false,
    joinStatus: 'joining',
  },
  invited: {
    ...group,
    currentUserIsMember: false,
    haveInvite: true,
  },
  requested: {
    ...group,
    privacy: 'private',
    currentUserIsMember: false,
    haveRequestedInvite: true,
  },
  needsInvite: {
    ...group,
    currentUserIsMember: false,
    privacy: 'private',
  },
  joinable: {
    ...group,
    currentUserIsMember: false,
    privacy: 'public',
  },
};

export default Object.fromEntries(
  Object.entries(groupFixtures).map(([key, group]) => {
    return [
      key,
      <FixtureWrapper key={key}>
        <GroupPreviewSheet
          open={true}
          onOpenChange={() => {}}
          group={group}
          onActionComplete={() => {}}
        />
      </FixtureWrapper>,
    ];
  })
);
