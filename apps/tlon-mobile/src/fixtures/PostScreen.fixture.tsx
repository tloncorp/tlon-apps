import { PostScreenView } from '@tloncorp/ui';

import { createFakePosts, group, tlonLocalBulletinBoard } from './fakeData';

const posts = createFakePosts(10);

export default (
  <>
    <PostScreenView
      currentUserId="~solfer-magfed"
      channel={tlonLocalBulletinBoard}
      posts={posts}
      sendReply={() => {}}
      groupMembers={group.members ?? []}
    />
  </>
);
