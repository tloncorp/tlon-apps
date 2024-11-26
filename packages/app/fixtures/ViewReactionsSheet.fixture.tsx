import { AppDataContextProvider } from '@tloncorp/ui/src';
import { ViewReactionsSheet } from '@tloncorp/ui/src/components/ChatMessage/ViewReactionsSheet';

import {
  createFakePosts,
  createFakeReactions,
  initialContacts,
} from './fakeData';

const posts = createFakePosts(15);

const post = posts[0];
post.reactions = createFakeReactions({
  count: 8,
  contacts: initialContacts,
  minTotal: 1,
  maxTotal: 5,
});

const secondPost = posts[1];
secondPost.reactions = createFakeReactions({
  count: 3,
  contacts: initialContacts,
}).slice(0, 2);

export default {
  many: (
    <AppDataContextProvider contacts={initialContacts}>
      <ViewReactionsSheet post={post} open={true} onOpenChange={() => {}} />
    </AppDataContextProvider>
  ),
  few: (
    <AppDataContextProvider contacts={initialContacts}>
      <ViewReactionsSheet
        post={secondPost}
        open={true}
        onOpenChange={() => {}}
      />
    </AppDataContextProvider>
  ),
};
