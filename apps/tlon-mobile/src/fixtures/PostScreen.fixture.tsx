import { PostScreenView } from '@tloncorp/ui/src/components/PostScreenView';

import { createFakePosts, tlonLocalBulletinBoard } from './fakeData';

const posts = createFakePosts(10);

export default (
  <>
    <PostScreenView
      currentUserId="~solfer-magfed"
      channel={tlonLocalBulletinBoard}
      posts={posts}
    />
  </>
);
