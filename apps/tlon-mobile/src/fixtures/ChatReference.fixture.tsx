import ChatReference from '@tloncorp/ui/src/components/ContentReference/ChatReference';

import { createFakePost, tlonLocalSupport } from './fakeData';

const fakePost = createFakePost();

const fakeContent = JSON.parse(fakePost.content as string);

export default (
  <ChatReference
    post={fakePost}
    channel={tlonLocalSupport}
    content={fakeContent}
    navigate={() => ({})}
  />
);
