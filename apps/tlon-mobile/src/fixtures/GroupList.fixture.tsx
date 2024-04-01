import type * as db from '@tloncorp/shared/dist/db';
import { GroupList } from '@tloncorp/ui';

export default {
  basic: (
    <GroupList
      pinned={
        [
          { id: '1', title: 'Pinned Group 1', isSecret: false },
          { id: '2', title: 'Pinned Group 2', isSecret: true },
        ] as db.Group[]
      }
      other={
        [
          { id: '3', title: 'Other Group 1', isSecret: false },
          { id: '4', title: 'Other Group 2', isSecret: true },
        ] as db.Group[]
      }
    />
  ),
  emptyPinned: (
    <GroupList
      pinned={[]}
      other={
        [
          { id: '3', title: 'Other Group, no pinned groups', isSecret: false },
        ] as db.Group[]
      }
    />
  ),
  loading: <GroupList pinned={[]} other={[]} />,
};
