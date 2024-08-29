import * as db from '@tloncorp/shared/dist/db';
import { AppDataContextProvider } from 'packages/ui/src';
import { ViewReactionsSheet } from 'packages/ui/src/components/ChatMessage/ViewReactionsSheet';

import {
  brianContact,
  createFakePosts,
  createFakeReactions,
  danContact,
  edContact,
  hunterContact,
} from './fakeData';

const contacts = [brianContact, danContact, edContact, hunterContact];
const posts = createFakePosts(15);

const post = posts[0];
post.reactions = createFakeReactions(10, contacts);

const secondPost = posts[1];
secondPost.reactions = createFakeReactions(3, contacts).slice(0, 2);

export default {
  many: (
    <AppDataContextProvider contacts={contacts}>
      <ViewReactionsSheet post={post} open={true} onOpenChange={() => {}} />
    </AppDataContextProvider>
  ),
  few: (
    <AppDataContextProvider contacts={contacts}>
      <ViewReactionsSheet
        post={secondPost}
        open={true}
        onOpenChange={() => {}}
      />
    </AppDataContextProvider>
  ),
};
